package com.ossi.iptv;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.PictureInPictureParams;
import android.app.UiModeManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.net.Uri;
import android.provider.Settings;
import android.util.Rational;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.core.content.FileProvider;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Hosts the Ossi IPTV web app (assets/www) in a transparent WebView.
 * Video is rendered by native ExoPlayer views placed BEHIND the WebView (see NativePlayers),
 * which mirrors how Samsung AVPlay works on Tizen.
 */
public class MainActivity extends Activity {

    private WebView web;
    private NativePlayers players;
    private boolean isTv;
    private boolean pipAllowed;
    private final Handler main = new Handler(Looper.getMainLooper());

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN
                | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        if (Build.VERSION.SDK_INT >= 28) {   // draw under the camera cut-out too (no black strip on the side)
            WindowManager.LayoutParams lp = getWindow().getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            getWindow().setAttributes(lp);
        }

        isTv = detectTv();

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        FrameLayout videoLayer = new FrameLayout(this);
        root.addView(videoLayer, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        web = new WebView(this);
        web.setBackgroundColor(Color.TRANSPARENT);
        web.setFocusable(true);
        web.setFocusableInTouchMode(true);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setAllowFileAccessFromFileURLs(true);
        s.setAllowUniversalAccessFromFileURLs(true);   // lets the app call the IPTV server (like <access origin="*"> on Tizen)
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setUseWideViewPort(true);          // honour <meta viewport> (no auto zoom on phones)
        s.setLoadWithOverviewMode(false);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        if (Build.VERSION.SDK_INT >= 21) s.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient());

        players = new NativePlayers(this, videoLayer, web);
        web.addJavascriptInterface(new Bridge(), "OssiNative");
        web.loadUrl("file:///android_asset/www/index.html");
        web.requestFocus();
        hideSystemBars();
    }

    private boolean detectTv() {
        try {
            UiModeManager ui = (UiModeManager) getSystemService(Context.UI_MODE_SERVICE);
            if (ui != null && ui.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION) return true;
        } catch (Exception ignored) { }
        PackageManager pm = getPackageManager();
        return pm.hasSystemFeature("android.software.leanback")
                || !pm.hasSystemFeature("android.hardware.touchscreen");
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    /** Android remote key -> Samsung Tizen keyCode used by the web app (0 = let the WebView handle it). */
    private static int tizenCode(int k) {
        switch (k) {
            case KeyEvent.KEYCODE_BACK:
            case KeyEvent.KEYCODE_ESCAPE:              return 10009;
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:        return 13;
            case KeyEvent.KEYCODE_PROG_RED:            return 403;
            case KeyEvent.KEYCODE_PROG_GREEN:          return 404;
            case KeyEvent.KEYCODE_PROG_YELLOW:         return 405;
            case KeyEvent.KEYCODE_PROG_BLUE:           return 406;
            case KeyEvent.KEYCODE_CHANNEL_UP:
            case KeyEvent.KEYCODE_PAGE_UP:             return 427;
            case KeyEvent.KEYCODE_CHANNEL_DOWN:
            case KeyEvent.KEYCODE_PAGE_DOWN:           return 428;
            case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE:    return 10252;
            case KeyEvent.KEYCODE_MEDIA_PLAY:          return 415;
            case KeyEvent.KEYCODE_MEDIA_PAUSE:         return 19;
            case KeyEvent.KEYCODE_MEDIA_STOP:          return 413;
            case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD:  return 417;
            case KeyEvent.KEYCODE_MEDIA_REWIND:        return 412;
            case KeyEvent.KEYCODE_INFO:
            case KeyEvent.KEYCODE_GUIDE:               return 457;
            case KeyEvent.KEYCODE_MENU:                return 18;     // ☰ (Fire TV / Android TV remotes)
            default:                                   return 0;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int code = tizenCode(e.getKeyCode());
        if (code != 0) {
            int a = e.getAction();
            if (a == KeyEvent.ACTION_DOWN) js("window.__ossiKey&&__ossiKey('keydown'," + code + ")");
            else if (a == KeyEvent.ACTION_UP) js("window.__ossiKey&&__ossiKey('keyup'," + code + ")");
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    void js(final String code) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            if (web != null) web.evaluateJavascript(code, null);
        } else {
            main.post(new Runnable() { @Override public void run() { if (web != null) web.evaluateJavascript(code, null); } });
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (Build.VERSION.SDK_INT >= 24 && isInPictureInPictureMode()) return;   // keep playing in the PiP window
        if (web != null) web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        hideSystemBars();
    }

    @Override
    protected void onStop() {
        super.onStop();
        if (web != null) web.onPause();
        if (players != null) players.stopAll();
    }

    /* ---------- picture in picture ---------- */
    private PictureInPictureParams pipParams(boolean auto) {
        PictureInPictureParams.Builder b = new PictureInPictureParams.Builder();
        float r = players != null ? players.ratio(1) : 0;
        if (r <= 0) r = 16f / 9f;
        r = Math.max(0.42f, Math.min(2.38f, r));
        b.setAspectRatio(new Rational(Math.round(r * 1000), 1000));
        if (Build.VERSION.SDK_INT >= 31) { b.setAutoEnterEnabled(auto); b.setSeamlessResizeEnabled(true); }
        return b.build();
    }

    private void doPip() {
        if (Build.VERSION.SDK_INT < 26) return;
        try { enterPictureInPictureMode(pipParams(pipAllowed)); } catch (Exception ignored) { }
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (pipAllowed && Build.VERSION.SDK_INT >= 26 && Build.VERSION.SDK_INT < 31) doPip();
    }

    @Override
    public void onPictureInPictureModeChanged(boolean inPip, Configuration cfg) {
        super.onPictureInPictureModeChanged(inPip, cfg);
        js("window.__ossiPip&&__ossiPip(" + inPip + ")");
        if (!inPip) hideSystemBars();
    }

    /* ---------- app update: download + install ---------- */
    private File updFile() { return new File(getCacheDir(), "update.apk"); }

    private void installUpdate() {
        File f = updFile();
        if (!f.exists()) return;
        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            js("window.__ossiUpd&&__ossiUpd('perm',0,null)");
            try {
                startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getPackageName())));
            } catch (Exception ignored) { }
            return;
        }
        try {
            Uri u = FileProvider.getUriForFile(this, getPackageName() + ".files", f);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(u, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            js("window.__ossiUpd&&__ossiUpd('inst',0,null)");
        } catch (Exception e) {
            js("window.__ossiUpd&&__ossiUpd('err',0," + JSONObject.quote(String.valueOf(e.getMessage())) + ")");
        }
    }

    private void downloadUpdate(final String url) {
        new Thread(new Runnable() {
            @Override public void run() {
                HttpURLConnection c = null;
                try {
                    String u = url;
                    for (int hop = 0; hop < 5; hop++) {          // follow redirects (GitHub -> CDN)
                        c = (HttpURLConnection) new URL(u).openConnection();
                        c.setInstanceFollowRedirects(false);
                        c.setConnectTimeout(15000);
                        c.setReadTimeout(30000);
                        int code = c.getResponseCode();
                        if (code >= 300 && code < 400) { u = c.getHeaderField("Location"); c.disconnect(); c = null; continue; }
                        if (code != 200) throw new Exception("HTTP " + code);
                        break;
                    }
                    if (c == null) throw new Exception("redirects");
                    long total = c.getContentLength();
                    File f = updFile();
                    InputStream in = c.getInputStream();
                    FileOutputStream out = new FileOutputStream(f);
                    byte[] buf = new byte[65536];
                    long done = 0; int n, last = -1;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n); done += n;
                        int pct = total > 0 ? (int) (done * 100 / total) : -1;
                        if (pct != last) { last = pct; js("window.__ossiUpd&&__ossiUpd('prog'," + pct + ",null)"); }
                    }
                    out.close(); in.close();
                    main.post(new Runnable() { @Override public void run() { installUpdate(); } });
                } catch (Exception e) {
                    js("window.__ossiUpd&&__ossiUpd('err',0," + JSONObject.quote(String.valueOf(e.getMessage())) + ")");
                } finally {
                    if (c != null) c.disconnect();
                }
            }
        }).start();
    }

    @Override
    protected void onDestroy() {
        if (players != null) players.releaseAll();
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }

    /** Called from JavaScript (runs on a background thread, so everything is posted to the UI thread). */
    private class Bridge {
        @JavascriptInterface public void open(final int id, final String url) {
            main.post(new Runnable() { @Override public void run() { players.open(id, url); } });
        }
        @JavascriptInterface public void prepare(final int id) {
            main.post(new Runnable() { @Override public void run() { players.prepare(id); } });
        }
        @JavascriptInterface public void play(final int id) {
            main.post(new Runnable() { @Override public void run() { players.play(id); } });
        }
        @JavascriptInterface public void pause(final int id) {
            main.post(new Runnable() { @Override public void run() { players.pause(id); } });
        }
        @JavascriptInterface public void stop(final int id) {
            main.post(new Runnable() { @Override public void run() { players.stop(id); } });
        }
        @JavascriptInterface public void close(final int id) {
            main.post(new Runnable() { @Override public void run() { players.close(id); } });
        }
        @JavascriptInterface public void seekTo(final int id, final double ms) {
            main.post(new Runnable() { @Override public void run() { players.seekTo(id, (long) ms); } });
        }
        @JavascriptInterface public void setRect(final int id, final int x, final int y, final int w, final int h) {
            main.post(new Runnable() { @Override public void run() { players.setRect(id, x, y, w, h); } });
        }
        @JavascriptInterface public void tracks(final int id) {
            main.post(new Runnable() { @Override public void run() { players.tracks(id); } });
        }
        @JavascriptInterface public void selectTrack(final int id, final String kind, final int group, final int track) {
            main.post(new Runnable() { @Override public void run() { players.selectTrack(id, kind, group, track); } });
        }
        @JavascriptInterface public void setAspect(final int id, final String mode) {
            main.post(new Runnable() { @Override public void run() { players.setAspect(id, mode); } });
        }
        @JavascriptInterface public void setPip(final boolean on) {
            main.post(new Runnable() { @Override public void run() {
                pipAllowed = on;
                if (Build.VERSION.SDK_INT >= 31) { try { setPictureInPictureParams(pipParams(on)); } catch (Exception ignored) { } }
            } });
        }
        @JavascriptInterface public boolean canPip() {
            return Build.VERSION.SDK_INT >= 26 && getPackageManager().hasSystemFeature(PackageManager.FEATURE_PICTURE_IN_PICTURE);
        }
        @JavascriptInterface public void enterPip() {
            main.post(new Runnable() { @Override public void run() { pipAllowed = true; doPip(); } });
        }
        @JavascriptInterface public void openUrl(final String url) {
            main.post(new Runnable() { @Override public void run() {
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); }
                catch (Exception e) { js("window.O&&O.toast&&O.toast('—')"); }
            } });
        }
        @JavascriptInterface public double getVolume() {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
            return max > 0 ? am.getStreamVolume(AudioManager.STREAM_MUSIC) / (double) max : 0;
        }
        @JavascriptInterface public void setVolume(final double f) {
            main.post(new Runnable() { @Override public void run() {
                AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                am.setStreamVolume(AudioManager.STREAM_MUSIC, (int) Math.round(Math.max(0, Math.min(1, f)) * max), 0);
            } });
        }
        @JavascriptInterface public double getBrightness() {
            float b = getWindow().getAttributes().screenBrightness;
            if (b < 0) {
                try { b = Settings.System.getInt(getContentResolver(), Settings.System.SCREEN_BRIGHTNESS) / 255f; }
                catch (Exception e) { b = 0.5f; }
            }
            return b;
        }
        @JavascriptInterface public void setBrightness(final double f) {
            main.post(new Runnable() { @Override public void run() {
                WindowManager.LayoutParams lp = getWindow().getAttributes();
                lp.screenBrightness = f < 0 ? WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE : (float) Math.max(0.02, Math.min(1, f));
                getWindow().setAttributes(lp);
            } });
        }
        @JavascriptInterface public int versionCode() { return BuildConfig.VERSION_CODE; }
        @JavascriptInterface public void downloadUpdate(final String url) { MainActivity.this.downloadUpdate(url); }
        @JavascriptInterface public void installUpdate() {
            main.post(new Runnable() { @Override public void run() { MainActivity.this.installUpdate(); } });
        }
        @JavascriptInterface public boolean isTv() { return isTv; }
        @JavascriptInterface public String version() { return BuildConfig.VERSION_NAME; }
        @JavascriptInterface public void exit() {
            main.post(new Runnable() { @Override public void run() { players.releaseAll(); finishAndRemoveTaskCompat(); } });
        }
    }

    private void finishAndRemoveTaskCompat() {
        if (Build.VERSION.SDK_INT >= 21) finishAndRemoveTask(); else finish();
    }
}
