"""Builds OssiTV-Web.html: the Ossi TV app as ONE offline HTML file (open it with a double click)."""
import re, base64, io, sys
from PIL import Image
import os
ROOT=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC=ROOT+'/app/src/main/assets/www/'
OUT=sys.argv[1] if len(sys.argv)>1 else ROOT+'/web/OssiTV-Web.html'
def datauri(path, width):
    im=Image.open(SRC+path).convert('RGBA'); im=im.resize((width,int(im.size[1]*width/im.size[0])),Image.LANCZOS)
    b=io.BytesIO(); im.save(b,'WEBP',quality=88); return 'data:image/webp;base64,'+base64.b64encode(b.getvalue()).decode()
LOGO=datauri('img/logo.png',720); LOGO_S=datauri('img/logo_s.png',300); ICON=datauri('icon.png',128)
html=open(SRC+'index.html',encoding='utf-8').read()
css=open(SRC+'css/style.css',encoding='utf-8').read()+'''
/* browser build */
html{background:#03041a}
#bvid{position:fixed;left:0;top:0;width:100%;height:100%;z-index:0;background:#000;object-fit:contain;visibility:hidden}
#stage{z-index:1}
#av-player{visibility:hidden!important}
#bvid::cue{font-size:1.15em;background:transparent;text-shadow:0 0 4px #000,0 0 4px #000}
'''
def js(name): return open(SRC+'js/'+name,encoding='utf-8').read().replace('</script','<\\/script')
scripts=re.findall(r'<script src="js/([^"]+)"></script>', html)
body=''
libs=('<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js"></script>\n'
      '<script src="https://cdn.jsdelivr.net/npm/mpegts.js@1.7.3/dist/mpegts.js"></script>\n')
LIBS=os.environ.get('OSSI_LIBS')   # desktop build: inline hls.js + mpegts.js from node_modules (works offline)
if LIBS:
    libs=''.join('<script>\n'+open(os.path.join(LIBS,f),encoding='utf-8').read().replace('</script','<\\/script')+'\n</script>\n'
                 for f in ('hls.js/dist/hls.min.js','mpegts.js/dist/mpegts.js'))
body+=libs+'<script>\n'+open(ROOT+'/web/browser.js',encoding='utf-8').read()+'\n</script>\n'
for n in scripts:
    if n=='android.js': continue
    body+='<script>\n/* '+n+' */\n'+js(n)+'\n</script>\n'
html=re.sub(r'(<script src="js/[^"]+"></script>\s*)+', lambda m: body, html, count=1)
html=html.replace('<link rel="stylesheet" href="css/style.css">','<link rel="icon" href="'+ICON+'">\n<style>\n'+css+'\n</style>')
html=html.replace('img/logo_s.png',LOGO_S).replace('img/logo.png',LOGO)
os.makedirs(os.path.dirname(os.path.abspath(OUT)),exist_ok=True)
open(OUT,'w',encoding='utf-8').write(html)
print('written',OUT,round(len(html)/1024),'KB; scripts:',[s for s in scripts if s!='android.js'])
