from pathlib import Path
p=Path('index.html')
s=p.read_text(encoding='utf-8')
css='''\n/* PHASE 1 COACHING UI */\n.ex-card{display:grid;grid-template-columns:1fr}\n.ex-card>.ex-head{grid-row:1}\n.ex-card>.reco-coach{grid-row:2;margin:0 16px 12px}\n.ex-card>.setrow{grid-row:auto}\n.reco-coach{padding:14px;border-radius:12px;background:linear-gradient(135deg,rgba(255,122,61,.16),rgba(53,201,176,.09));border:1px solid rgba(255,122,61,.34);font-size:13px}\n.reco-coach .coach-title{font-size:10.5px;letter-spacing:.8px;margin-bottom:5px}\n.reco-coach .coach-main{font-size:19px;font-weight:900;line-height:1.25}\n.reco-coach .coach-detail{font-size:12px;margin-top:5px}\n.reco-coach:before{content:'TODAY COACHING';display:block;color:var(--accent);font-size:10px;font-weight:900;letter-spacing:.8px;margin-bottom:3px}\n'''
if '/* PHASE 1 COACHING UI */' not in s:
    s=s.replace('</style>',css+'\n</style>',1)
p.write_text(s,encoding='utf-8')
