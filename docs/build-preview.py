from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
scripts=[]
for name in ['core.js','catalog.js','area.js','image.js','service.js','placement.js','cabinet.js','view.js','manager-view.js','image-editor.js']:
    src=(ROOT/'scripts'/name).read_text()
    src=re.sub(r'^import .*?;\n','',src,flags=re.M)
    src=re.sub(r'^export \{.*?\} from .*?;\n','',src,flags=re.M)
    src=re.sub(r'\bexport (?=(?:const|class|function|async))','',src)
    # view.js aliases escapeHTML to e via its import.
    if name=='view.js':src='const e=escapeHTML;\n'+src
    scripts.append(src)
ui=(ROOT/'scripts/ui.js').read_text()
ui=re.sub(r'^import .*?;\n','',ui,flags=re.M)
ui=ui.replace('export class','class')
harness=(ROOT/'docs/preview-harness.js').read_text()
split=harness.index('const previewService=')
code='\n'.join(scripts)+'\n'+harness[:split]+'\n'+ui+'\n'+harness[split:]
css=(ROOT/'styles/vending.css').read_text()
html='''<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Máquina de lanches / Prévia</title><style>'''+css+'''
html,body{margin:0;min-height:100%;background:#e6e0d5;color:#4b4035;font:13px "Segoe UI",sans-serif}body{padding:28px 24px;background:radial-gradient(ellipse at 50% 0,#fcf6ea,#e5ddd0 75%)}.preview-top{max-width:1140px;margin:0 auto 18px;display:flex;justify-content:space-between;gap:14px;align-items:center}.preview-top h1{font-size:16px;margin:0 0 4px}.preview-top p{margin:0;color:#887761;font-size:11px}.preview-controls{display:flex;gap:12px;align-items:center;flex-wrap:wrap;font-size:11px}.preview-controls button,.preview-controls select{background:#f4eee2;color:#5b4a37;border:1px solid #ccbeaa;border-radius:6px;padding:7px 9px;font:inherit}.preview-controls label{display:flex;align-items:center;gap:4px}.preview-controls input{accent-color:#6de6c6}.preview-frame{max-width:920px;height:850px;max-height:calc(100vh - 125px);min-height:700px;margin:auto;border:1px solid #cfc4b4;border-radius:12px;box-shadow:0 18px 50px #473a2326;overflow:hidden}.preview-frame.is-manager{max-width:1180px;height:820px}.preview-foot{max-width:1140px;margin:12px auto;color:#887761;font-size:10px}.preview-dialog{background:#f5f0e4;color:#4b4035;border:1px solid #cabbab;border-radius:14px;max-width:460px;padding:25px;font:13px "Segoe UI",sans-serif}.preview-dialog h2{font-size:18px;margin:0 0 15px}.preview-dialog input{width:90%;padding:6px;background:#fff9ef;color:#4b4035;border:1px solid #cabbab;margin:6px}.preview-dialog footer{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.preview-dialog button{padding:8px 14px;cursor:pointer}.preview-dialog::backdrop{background:#000b}.preview-closed{padding:50px;color:#887761}@media(max-width:760px){body{padding:12px;min-width:700px}.preview-top{flex-wrap:wrap}.preview-frame{min-height:600px;max-height:none}}
.preview-map-overlay{position:fixed;inset:0;background:#332c20b8;z-index:100;display:flex;align-items:center;justify-content:center;padding:25px}.preview-map-panel{background:#f5f0e7;border:1px solid #c5b89f;border-radius:14px;width:850px;max-width:95vw;padding:22px;color:#514231;box-shadow:0 30px 80px #0003}.preview-map-head{display:flex;gap:15px;align-items:center;justify-content:space-between;margin-bottom:15px}.preview-map-head h2{font:22px Georgia,serif;margin:0 0 5px}.preview-map-head p{font-size:12px;margin:0;color:#8b7762}.preview-map-head button,.preview-map-actions button{padding:9px 14px;background:#eee5d7;border:1px solid #ccbda9;border-radius:6px;color:#594b39;cursor:pointer}.preview-map-actions{display:flex;gap:8px;margin-top:12px}.preview-map-actions button.primary{background:#8b493b;color:#fff;border-color:#8b493b}.preview-map-svg{width:100%;height:430px;display:block;background:#eeE9dc;border:1px solid #bfb8a7;cursor:crosshair;border-radius:6px}.preview-map-tip{font-size:10px;color:#8b7964;margin:10px 0 0}
</style></head><body>
<header class="preview-top"><div><h1>Máquina de lanches</h1><p>Selecione, retire e pegue seu lanche · Prévia interativa</p></div><div class="preview-controls"><select id="preview-role" aria-label="Papel"><option value="gm">Mestre</option><option value="player">Jogador</option></select><label><input type="checkbox" id="preview-inside" checked>Token na área</label><label><input type="checkbox" id="preview-online" checked>Mestre online</label><button id="preview-close">Fechar</button><button id="preview-open">Abrir máquina</button><button id="preview-scale">Testar 200 produtos</button><button id="preview-reset">Restaurar exemplo</button></div></header>
<div id="preview-app" class="preview-frame"></div><footer class="preview-foot"><span id="preview-notice">Experimente a máquina. Para testar o desenho da área, use “Demarcar área” como mestre.</span></footer><script type="module">'''+code.replace('</script>','<\\/script>')+'</script></body></html>'
for name,manager_mode in [('Maquina-de-Lanches-Preview.html',False),('Gerenciamento-Mestre-Preview.html',True)]:
    output=html.replace('<script type="module">','<script type="module">const PREVIEW_MANAGER='+str(manager_mode).lower()+';')
    if manager_mode:output=output.replace('<title>Máquina de lanches / Prévia</title>','<title>Gerenciamento do Mestre / Prévia</title>').replace('<h1>Máquina de lanches</h1>','<h1>Gerenciamento do mestre</h1>').replace('Selecione, retire e pegue seu lanche · Prévia interativa','Configure produtos, imagens, cores e áreas · Prévia interativa')
    (ROOT/name).write_text(output)
    print(ROOT/name)
