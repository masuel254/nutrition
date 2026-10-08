"""Disposition automatique du workflow : un couloir par branche (action de l'appli, type de message Telegram,
planification), nœuds rangés par profondeur de gauche à droite. Ne touche qu'aux positions et aux notes."""
import json,sys,uuid
from collections import deque,defaultdict
src,dst=sys.argv[1],sys.argv[2]
w=json.load(open(src));N={n['name']:n for n in w['nodes']};C=w['connections']
DX,DY,GAP=300,150,260          # pas horizontal, vertical, écart entre couloirs
SPLIT=['Action','Callback Type','Type Saisie','Route']
succ=defaultdict(list)
for s,v in C.items():
    for b,o in enumerate(v.get('main',[])):
        for x in o:succ[s].append((b,x['node']))
inc=defaultdict(int)
for s in succ:
    for b,t in succ[s]:inc[t]+=1
notes=[n for n in N if 'stickyNote' in N[n]['type']]
trig=[n for n in N if inc[n]==0 and n not in notes]
def label(sw,b):
    try:
        r=N[sw]['parameters']['rules']['values'][b]
        if r.get('outputKey'):return r['outputKey']
        return str(r['conditions']['conditions'][0]['rightValue'])
    except Exception:return 'sortie %d'%b
# 1) couloirs : départ de chaque déclencheur, puis une branche par sortie des aiguillages principaux
lanes=[];owner={}
def explore(start,titre):
    lane={'titre':titre,'nodes':[],'depth':{}};lanes.append(lane)
    q=deque([(start,0)]);sub=[]
    while q:
        n,d=q.popleft()
        if n in owner:
            continue
        owner[n]=lane;lane['nodes'].append(n);lane['depth'][n]=d
        if n in SPLIT and n!=start or (n in SPLIT and n==start and titre.startswith('__')):
            pass
        for b,t in succ[n]:
            if n in SPLIT:sub.append((t,n,b))
            elif t not in owner:q.append((t,d+1))
    return sub
pending=[]
for t in sorted(trig,key=lambda x:(x!='Webhook API',x!='Telegram Trigger',x)):
    pending+=[(s,'%s → %s'%(sw,label(sw,b))) for s,sw,b in explore(t,{'Webhook API':'APPLI : entrée et authentification','Telegram Trigger':'TELEGRAM : entrée'}.get(t,'PLANIFIÉ : '+t))]
    while pending:
        s,titre=pending.pop(0)
        if s in owner:continue
        lab=titre.split(' → ',1)[-1]
        if lab in ('True','False','')or lab.startswith('sortie'):titre=titre.split(' → ')[0]+' → '+s
        titre=titre.replace('Action → ','APPLI · ').replace('Callback Type → ','TELEGRAM bouton · ').replace('Type Saisie → ','TELEGRAM saisie · ').replace('Route → ','TELEGRAM · ')
        pending+=[(x,'%s → %s'%(sw,label(sw,b))) for x,sw,b in explore(s,titre)]
# nœuds jamais atteints (sécurité)
reste=[n for n in N if n not in owner and n not in notes]
if reste:
    l={'titre':'Divers','nodes':reste,'depth':{n:i for i,n in enumerate(reste)}};lanes.append(l)
    for n in reste:owner[n]=l
# 2) placement : trois grandes colonnes (appli, Telegram, planifié), couloirs empilés dans chacune,
#    et dans un couloir : colonnes = profondeur, lignes empilées
groupe=lambda l:0 if l['titre'].startswith('APPLI') else (2 if l['titre'].startswith('PLANIF') else 1)
largeur=lambda l:(max(l['depth'].values())+1)*DX
GX=[0,0,0];L0=[l for l in lanes if groupe(l)==0];L1=[l for l in lanes if groupe(l)==1]
GX[1]=max(largeur(l) for l in L0)+900;GX[2]=GX[1]+max(largeur(l) for l in L1)+900
YG=[0,0,0];heads=[]
for lane in lanes:
    g=groupe(lane);y=YG[g];X0=GX[g]
    cols=defaultdict(list)
    for n in lane['nodes']:cols[lane['depth'][n]].append(n)
    haut=max(len(v) for v in cols.values())
    heads.append((lane['titre'],y,X0))
    pred=defaultdict(list)
    for a_ in lane['nodes']:
        for _,t in succ[a_]:
            if t in lane['depth']:pred[t].append(a_)
    rang={}
    for d in sorted(cols):  # ordre dans la colonne : moyenne des rangs des parents (moins de croisements)
        ns=cols[d]
        ns.sort(key=lambda n:(sum(rang[p] for p in pred[n] if p in rang)/max(1,len([p for p in pred[n] if p in rang])) if any(p in rang for p in pred[n]) else 0))
        for i,n in enumerate(ns):rang[n]=i;N[n]['position']=[X0+d*DX,y+80+i*DY]
    lane['y']=y;lane['h']=80+haut*DY;lane['x']=X0
    YG[g]=y+lane['h']+GAP
y=max(YG)
# 3) notes : les explications existantes en haut à gauche, un titre par couloir
w['nodes']=[n for n in w['nodes'] if not (n['type'].endswith('stickyNote') and n['name'].startswith('Couloir '))]
xn=-900
for i,nm in enumerate(notes):N[nm]['position']=[xn,i*340]
for i,(t,yy,X0) in enumerate(heads):
    larg=max(DX*(max(lanes[i]['depth'].values())+1),600)
    w['nodes'].append({'parameters':{'content':'## '+t,'height':lanes[i]['h']+40,'width':larg,'color':(i%6)+1},
      'id':str(uuid.uuid4()),'name':'Couloir %02d'%(i+1),'type':'n8n-nodes-base.stickyNote','typeVersion':1,'position':[X0-60,yy-20]})
json.dump(w,open(dst,'w'),ensure_ascii=False,indent=2)
print(len(lanes),'couloirs, hauteur totale',y)
for l in lanes:print('  %-55s %3d nœuds, %2d colonnes'%(l['titre'][:55],len(l['nodes']),max(l['depth'].values())+1))
