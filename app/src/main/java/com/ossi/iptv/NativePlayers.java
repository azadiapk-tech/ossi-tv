package com.ossi.iptv;

import android.content.Context;
import android.graphics.Color;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.TextureView;
import android.view.View;
import android.webkit.WebView;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.Format;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MimeTypes;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.TrackGroup;
import androidx.media3.common.TrackSelectionOverride;
import androidx.media3.common.Tracks;
import androidx.media3.common.VideoSize;
import androidx.media3.common.text.CueGroup;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultRenderersFactory;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.audio.AudioCapabilities;
import androidx.media3.exoplayer.audio.AudioSink;
import androidx.media3.exoplayer.audio.DefaultAudioSink;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.extractor.DefaultExtractorsFactory;
import androidx.media3.extractor.ts.DefaultTsPayloadReaderFactory;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.CaptionStyleCompat;
import androidx.media3.ui.SubtitleView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Native video players addressed by id from JavaScript (id 1 = webapis.avplay, others = avplaystore players).
 * Each player draws into a TextureView (composited inside the view tree, so it always shows through the
 * transparent WebView) plus a SubtitleView, inside a layer that sits behind the WebView.
 * Events go back with window.__ossiEvt(id, type, number, text).
 */
@UnstableApi
final class NativePlayers {

    private static final String UA = "Mozilla/5.0 (Linux; Android) OssiTV/1.2 ExoPlayer";

    private final Context ctx;
    private final FrameLayout layer;
    private final WebView web;
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Map<Integer, Slot> slots = new HashMap<>();

    private static final class Slot {
        int id;
        String url;
        ExoPlayer exo;
        FrameLayout box;              // positioned at the rect the web app asked for
        AspectRatioFrameLayout ar;    // keeps the picture's aspect ratio
        TextureView tex;
        SubtitleView subs;
        boolean prepared;
        int gen;                      // ignores late events from a player that was already replaced
        int x, y, w = 1, h = 1;
        float ratio;                  // picture aspect ratio of the current video
        boolean audioRetried;         // sound mode already switched once for this stream
        String mode = "fit";          // fit | zoom | fill | 16:9 | 4:3
    }

    NativePlayers(Context ctx, FrameLayout layer, WebView web) {
        this.ctx = ctx;
        this.layer = layer;
        this.web = web;
        main.postDelayed(ticker, 500);
    }

    private final Runnable ticker = new Runnable() {
        @Override public void run() {
            for (Slot s : slots.values()) {
                if (s.exo != null && s.prepared && s.exo.isPlaying()) {
                    emit(s.id, "time", s.exo.getCurrentPosition(), null);
                }
            }
            main.postDelayed(this, 500);
        }
    };

    private Slot slot(int id) {
        Slot s = slots.get(id);
        if (s == null) {
            s = new Slot();
            s.id = id;
            s.box = new FrameLayout(ctx);
            s.box.setBackgroundColor(Color.BLACK);
            s.box.setVisibility(View.GONE);

            s.ar = new AspectRatioFrameLayout(ctx);
            s.ar.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
            s.tex = new TextureView(ctx);
            s.ar.addView(s.tex, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
            s.box.addView(s.ar, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT, Gravity.CENTER));

            s.subs = new SubtitleView(ctx);
            s.subs.setApplyEmbeddedStyles(true);
            s.subs.setApplyEmbeddedFontSizes(false);
            s.subs.setFractionalTextSize(SubtitleView.DEFAULT_TEXT_SIZE_FRACTION * 1.15f);
            s.subs.setBottomPaddingFraction(0.09f);
            s.subs.setStyle(new CaptionStyleCompat(Color.WHITE, Color.TRANSPARENT, Color.TRANSPARENT,
                    CaptionStyleCompat.EDGE_TYPE_OUTLINE, Color.BLACK, null));
            s.box.addView(s.subs, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

            layer.addView(s.box, new FrameLayout.LayoutParams(1, 1));
            slots.put(id, s);
        }
        return s;
    }

    /* ---------- sound ----------
       Live channels often carry Dolby (AC3 / E-AC3) sound. Passing it raw to the TV ("passthrough") can get stuck
       on Fire TV after the app was closed: the picture plays, the sound is gone until the stick restarts.
       So when the device can decode Dolby itself we always decode in the app (normal PCM sound, like movies).
       If a stream still ends up without any sound track, we switch the mode once and restart it. */
    private static Boolean pcmOnly = null;
    private static boolean hasDecoder(String mime) {
        try {
            android.media.MediaCodecList l = new android.media.MediaCodecList(android.media.MediaCodecList.ALL_CODECS);
            for (android.media.MediaCodecInfo ci : l.getCodecInfos()) {
                if (ci.isEncoder()) continue;
                for (String t : ci.getSupportedTypes()) if (t.equalsIgnoreCase(mime)) return true;
            }
        } catch (Throwable ignored) { }
        return false;
    }
    private boolean pcm() {
        if (pcmOnly == null) pcmOnly = hasDecoder(MimeTypes.AUDIO_AC3);
        return pcmOnly;
    }
    private DefaultRenderersFactory renderers() {
        final boolean pcm = pcm();
        DefaultRenderersFactory f = new DefaultRenderersFactory(ctx) {
            @Override
            @SuppressWarnings("deprecation")
            protected AudioSink buildAudioSink(Context c, boolean enableFloatOutput, boolean enableAudioTrackPlaybackParams) {
                if (!pcm) return super.buildAudioSink(c, enableFloatOutput, enableAudioTrackPlaybackParams);
                return new DefaultAudioSink.Builder(c)
                        .setAudioCapabilities(AudioCapabilities.DEFAULT_AUDIO_CAPABILITIES)
                        .setEnableFloatOutput(enableFloatOutput)
                        .setEnableAudioTrackPlaybackParams(enableAudioTrackPlaybackParams)
                        .build();
            }
        };
        f.setEnableDecoderFallback(true);
        return f;
    }

    void open(int id, String url) {
        Slot s = slot(id);
        releaseExo(s);
        s.url = url;
        s.audioRetried = false;
    }

    void prepare(int id) {
        final Slot s = slot(id);
        if (s.url == null) { emit(id, "error", 0, "no url"); return; }
        releaseExo(s);
        final int gen = ++s.gen;

        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
                .setUserAgent(UA)
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(12000)
                .setReadTimeoutMs(20000);
        DefaultExtractorsFactory ext = new DefaultExtractorsFactory()
                .setTsExtractorFlags(DefaultTsPayloadReaderFactory.FLAG_ALLOW_NON_IDR_KEYFRAMES
                        | DefaultTsPayloadReaderFactory.FLAG_DETECT_ACCESS_UNITS);
        ExoPlayer exo = new ExoPlayer.Builder(ctx, renderers())
                .setMediaSourceFactory(new DefaultMediaSourceFactory(http, ext))
                .build();
        exo.setAudioAttributes(new AudioAttributes.Builder()
                .setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MOVIE).build(), true);

        MediaItem.Builder item = new MediaItem.Builder().setUri(s.url);
        if (s.url.toLowerCase(Locale.ROOT).contains(".m3u8")) item.setMimeType(MimeTypes.APPLICATION_M3U8);

        exo.addListener(new Player.Listener() {
            @Override public void onPlaybackStateChanged(int state) {
                if (s.gen != gen || s.exo == null) return;
                if (state == Player.STATE_BUFFERING) {
                    if (s.prepared) emit(s.id, "buffering", 0, null);
                } else if (state == Player.STATE_READY) {
                    if (!s.prepared) {
                        s.prepared = true;
                        emit(s.id, "ready", duration(s.exo), null);
                    } else {
                        emit(s.id, "dur", duration(s.exo), null);
                        emit(s.id, "buffered", 0, null);
                    }
                } else if (state == Player.STATE_ENDED) {
                    emit(s.id, "ended", 0, null);
                }
            }

            @Override public void onVideoSizeChanged(@NonNull VideoSize v) {
                if (s.gen != gen || v.width <= 0 || v.height <= 0) return;
                s.ratio = v.height == 0 ? 1f : (v.width * v.pixelWidthHeightRatio) / v.height;
                applyAspect(s);
                Format f = s.exo != null ? s.exo.getVideoFormat() : null;
                float fps = f != null && f.frameRate > 0 ? f.frameRate : 0;
                emit(s.id, "vsize", v.width, v.width + "x" + v.height + "x" + Math.round(fps));
            }

            @Override public void onRenderedFirstFrame() {
                if (s.gen != gen) return;
                s.tex.setAlpha(1f);
            }

            @Override public void onCues(@NonNull CueGroup cues) {
                if (s.gen != gen) return;
                s.subs.setCues(cues.cues);
            }

            @Override public void onTracksChanged(@NonNull Tracks tracks) {
                if (s.gen != gen) return;
                emit(s.id, "trackschanged", 0, null);
                boolean hasAudio = false, audioOn = false;
                for (Tracks.Group g : tracks.getGroups()) {
                    if (g.getType() != C.TRACK_TYPE_AUDIO) continue;
                    hasAudio = true;
                    if (g.isSelected()) audioOn = true;
                }
                if (hasAudio && !audioOn) {
                    if (!s.audioRetried) {               // the sound could not be used: switch mode once and restart
                        s.audioRetried = true;
                        pcmOnly = !pcm();
                        final boolean play = s.exo != null && s.exo.getPlayWhenReady();
                        main.post(new Runnable() { @Override public void run() {
                            if (s.gen != gen) return;
                            prepare(s.id);
                            if (play && s.exo != null) s.exo.setPlayWhenReady(true);
                        } });
                    } else {
                        emit(s.id, "toast", 0, "\u062a\u0639\u0630\u0651\u0631 \u062a\u0634\u063a\u064a\u0644 \u0635\u0648\u062a \u0647\u0630\u0627 \u0627\u0644\u0628\u062b");
                    }
                }
            }

            @Override public void onPlayerError(@NonNull PlaybackException e) {
                if (s.gen != gen || s.exo == null) return;
                if (e.errorCode == PlaybackException.ERROR_CODE_BEHIND_LIVE_WINDOW) {
                    s.exo.seekToDefaultPosition();
                    s.exo.prepare();
                    return;
                }
                String msg = e.getErrorCodeName();
                if (e.getMessage() != null) msg += " " + e.getMessage();
                emit(s.id, "error", e.errorCode, msg);
            }
        });

        s.exo = exo;
        s.prepared = false;
        s.subs.setCues(null);
        s.tex.setAlpha(0f);
        exo.setVideoTextureView(s.tex);
        s.box.setVisibility(View.VISIBLE);
        applyRect(s);
        exo.setMediaItem(item.build());
        exo.setPlayWhenReady(false);
        exo.prepare();
    }

    void play(int id) {
        Slot s = slots.get(id);
        if (s != null && s.exo != null) s.exo.setPlayWhenReady(true);
    }

    void pause(int id) {
        Slot s = slots.get(id);
        if (s != null && s.exo != null) s.exo.setPlayWhenReady(false);
    }

    void stop(int id) {
        Slot s = slots.get(id);
        if (s != null) releaseExo(s);
    }

    void close(int id) {
        Slot s = slots.get(id);
        if (s != null) { releaseExo(s); s.url = null; }
    }

    void seekTo(int id, long ms) {
        Slot s = slots.get(id);
        if (s != null && s.exo != null) s.exo.seekTo(Math.max(0, ms));
    }

    void setRect(int id, int x, int y, int w, int h) {
        Slot s = slot(id);
        s.x = x; s.y = y; s.w = Math.max(1, w); s.h = Math.max(1, h);
        applyRect(s);
    }

    /** Sends the audio and subtitle tracks to JS as a 'tracks' event (JSON text). */
    void tracks(int id) {
        Slot s = slots.get(id);
        JSONObject out = new JSONObject();
        try {
            JSONArray audio = new JSONArray(), text = new JSONArray();
            boolean textOn = false;
            if (s != null && s.exo != null) {
                Locale ui = new Locale("ar");
                Tracks tr = s.exo.getCurrentTracks();
                for (int gi = 0; gi < tr.getGroups().size(); gi++) {
                    Tracks.Group g = tr.getGroups().get(gi);
                    int type = g.getType();
                    if (type != C.TRACK_TYPE_AUDIO && type != C.TRACK_TYPE_TEXT) continue;
                    for (int ti = 0; ti < g.length; ti++) {
                        if (!g.isTrackSupported(ti)) continue;
                        Format f = g.getTrackFormat(ti);
                        JSONObject o = new JSONObject();
                        o.put("g", gi);
                        o.put("t", ti);
                        o.put("label", f.label == null ? "" : f.label);
                        o.put("lang", f.language == null ? "" : f.language);
                        String disp = "";
                        if (f.language != null && !f.language.equals("und")) {
                            try { disp = new Locale(f.language).getDisplayLanguage(ui); } catch (Exception ignored) { }
                        }
                        o.put("name", disp);
                        o.put("ch", f.channelCount == Format.NO_VALUE ? 0 : f.channelCount);
                        o.put("sel", g.isTrackSelected(ti));
                        if (type == C.TRACK_TYPE_AUDIO) audio.put(o);
                        else { text.put(o); if (g.isTrackSelected(ti)) textOn = true; }
                    }
                }
            }
            out.put("audio", audio);
            out.put("text", text);
            out.put("textOn", textOn);
        } catch (Exception ignored) { }
        emit(id, "tracks", 0, out.toString());
    }

    /** kind: "audio" | "text"; group/track from tracks(); for text, group < 0 turns subtitles off. */
    void selectTrack(int id, String kind, int group, int track) {
        Slot s = slots.get(id);
        if (s == null || s.exo == null) return;
        int type = "text".equals(kind) ? C.TRACK_TYPE_TEXT : C.TRACK_TYPE_AUDIO;
        try {
            if (type == C.TRACK_TYPE_TEXT && group < 0) {
                s.exo.setTrackSelectionParameters(s.exo.getTrackSelectionParameters().buildUpon()
                        .setTrackTypeDisabled(C.TRACK_TYPE_TEXT, true).build());
                s.subs.setCues(null);
                return;
            }
            Tracks.Group g = s.exo.getCurrentTracks().getGroups().get(group);
            TrackGroup tg = g.getMediaTrackGroup();
            s.exo.setTrackSelectionParameters(s.exo.getTrackSelectionParameters().buildUpon()
                    .setTrackTypeDisabled(type, false)
                    .setOverrideForType(new TrackSelectionOverride(tg, track))
                    .build());
        } catch (Exception e) {
            emit(id, "toast", 0, String.valueOf(e.getMessage()));
        }
    }

    float ratio(int id) {
        Slot s = slots.get(id);
        return s == null ? 0 : s.ratio;
    }

    void setAspect(int id, String mode) {
        Slot s = slot(id);
        s.mode = mode == null ? "fit" : mode;
        applyAspect(s);
    }

    private void applyAspect(Slot s) {
        String m = s.mode;
        if ("zoom".equals(m)) {
            s.ar.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_ZOOM); s.ar.setAspectRatio(s.ratio);
        } else if ("fill".equals(m)) {
            s.ar.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FILL); s.ar.setAspectRatio(s.ratio);
        } else if ("16:9".equals(m)) {
            s.ar.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT); s.ar.setAspectRatio(16f / 9f);
        } else if ("4:3".equals(m)) {
            s.ar.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT); s.ar.setAspectRatio(4f / 3f);
        } else {
            s.ar.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT); s.ar.setAspectRatio(s.ratio);
        }
    }

    private void applyRect(Slot s) {
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(s.w, s.h);
        lp.leftMargin = s.x;
        lp.topMargin = s.y;
        s.box.setLayoutParams(lp);
        s.box.requestLayout();
    }

    void stopAll() {
        for (Slot s : slots.values()) releaseExo(s);
    }

    void releaseAll() {
        main.removeCallbacks(ticker);
        for (Slot s : slots.values()) {
            releaseExo(s);
            layer.removeView(s.box);
        }
        slots.clear();
    }

    private void releaseExo(Slot s) {
        s.gen++;
        s.prepared = false;
        if (s.exo != null) {
            try { s.exo.stop(); } catch (Exception ignored) { }
            try { s.exo.clearVideoTextureView(s.tex); } catch (Exception ignored) { }
            try { s.exo.release(); } catch (Exception ignored) { }
            s.exo = null;
        }
        if (s.subs != null) s.subs.setCues(null);
        if (s.tex != null) s.tex.setAlpha(0f);
        s.ratio = 0;
        if (s.ar != null) applyAspect(s);
        if (s.box != null) s.box.setVisibility(View.GONE);
    }

    private static long duration(ExoPlayer p) {
        long d = p.getDuration();
        return (d == C.TIME_UNSET || d < 0) ? 0 : d;
    }

    private void emit(int id, String type, long n, String text) {
        if (web == null) return;
        String js = "window.__ossiEvt&&__ossiEvt(" + id + ",'" + type + "'," + n + ","
                + (text == null ? "null" : JSONObject.quote(text)) + ")";
        web.evaluateJavascript(js, null);
    }
}
