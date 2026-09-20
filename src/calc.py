import math, json
D = {}
# ---------- Site ----------
marla = 25.2929
plot = 10*marla
cov = 0.60
foot = plot*cov
L_roof = 15.0
W_roof = foot/L_roof
setb = 0.6
inner = (L_roof-2*setb)*(W_roof-2*setb)
ded = [("Staircase head-room (mumty)",12.0),("Water-tank platform (2 x 1,000 L)",6.0),("Shadow buffer around mumty and tanks",8.0),("Ventilation shafts, solar water heater, dish/antenna",3.0)]
usable = inner - sum(v for _,v in ded)
D['site'] = dict(marla=marla, plot=plot, cov=cov, foot=foot, L=L_roof, W=W_roof, setb=setb, inner=inner, ded=ded, usable_calc=usable, usable_sel=94.0, plot_ft2=plot*10.764, plot_sqyd=plot*1.19599, foot_ft2=foot*10.764)

# ---------- Loads (summer peak) ----------
loads = [
 ("Air conditioners (1.5-ton inverter split)", "3 units", 1.10, 6.0, 3*1.10*6.0),
 ("Ceiling fans", "6 fans", 0.075, 10.0, 6*0.075*10.0),
 ("Refrigerator (300 L frost-free)", "1 unit", 0.20, 9.0, 0.20*9.0),
 ("Water pump", "1 unit", 0.75, 1.2, 0.75*1.2),
 ("LED lighting", "20 lamps", 0.012, 6.0, 20*0.012*6.0),
 ("TV and set-top box", "2 sets", 0.10, 4.0, 2*0.10*4.0),
 ("Washing machine", "1 unit", 0.50, 1.0, 0.50*1.0),
 ("Kitchen (microwave, mixer, induction)", "Lumped", 1.00, 1.0, 1.00*1.0),
 ("Wi-Fi router, laptops, chargers", "Lumped", 0.25, 8.0, 0.25*8.0),
]
E_day = sum(l[4] for l in loads)
AC_day = loads[0][4]
base_day = E_day - AC_day
D['loads'] = loads; D['E_day']=E_day; D['AC_day']=AC_day; D['base_day']=base_day

peak = [("3 air conditioners (3 x 1.4 kW)",3*1.4),("6 ceiling fans (6 x 0.075 kW)",6*0.075),("Refrigerator",0.25),("Water pump",0.75),("LED lighting (20 x 12 W)",0.24),("TV and set-top boxes",0.20),("Washing machine",0.50),("Kitchen appliances",1.20),("Wi-Fi, laptops, chargers",0.25)]
conn = sum(v for _,v in peak)
div = 0.85
coinc = conn*div
design_peak = coinc*1.25
D['peak']=peak; D['conn']=conn; D['div']=div; D['coinc']=coinc; D['design_peak']=design_peak

# ---------- Monthly model ----------
months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
days = [31,28,31,30,31,30,31,31,30,31,30,31]
acf = [0,0,0.10,0.45,1.0,1.0,0.90,0.90,0.70,0.25,0,0]
heat = [3.0,2.0,0.5,0,0,0,0,0,0,0,1.5,3.0]
psh = [4.0,4.8,5.7,6.4,6.6,6.2,5.0,4.9,5.4,5.3,4.6,3.9]
daily_load = [base_day + AC_day*a + h for a,h in zip(acf,heat)]
mload = [d*l for d,l in zip(days,daily_load)]
E_year = sum(mload)
GTI_year = sum(p*d for p,d in zip(psh,days))
psh_avg = GTI_year/365
D['months']=months; D['days']=days; D['acf']=acf; D['heat']=heat; D['psh']=psh
D['daily_load']=daily_load; D['mload']=mload; D['E_year']=E_year; D['GTI_year']=GTI_year; D['psh_avg']=psh_avg

# ---------- Performance ratio ----------
losses = [("Module temperature (annual average)",7.5),("Soiling (dust, fortnightly cleaning)",4.0),("Module mismatch and quality",1.5),("Angle-of-incidence and spectral",2.0),("DC wiring",1.0),("Inverter (MPPT + conversion)",2.5),("AC wiring",0.5),("Availability / grid downtime",1.0)]
PR_calc = 1.0
for _,l in losses: PR_calc *= (1-l/100)
PR = 0.78
D['losses']=losses; D['PR_calc']=PR_calc; D['PR']=PR

# ---------- PV sizing ----------
pv_peakday = E_day/(psh_avg*PR)
pv_annual = E_year/(GTI_year*PR)
mod_W = 550
n_mod = 12
kWp = n_mod*mod_W/1000
D['pv_peakday']=pv_peakday; D['pv_annual']=pv_annual; D['n_mod']=n_mod; D['kWp']=kWp
gen_daily = [kWp*p*PR for p in psh]
mgen = [g*d for g,d in zip(gen_daily,days)]
G_year = sum(mgen)
D['gen_daily']=gen_daily; D['mgen']=mgen; D['G_year']=G_year
D['net_m']=[g-l for g,l in zip(mgen,mload)]
D['net_year']=G_year-E_year
D['cover']=G_year/E_year
D['spec_yield']=G_year/kWp

# ---------- Module ----------
mod = dict(Pmax=550, Vmp=42.3, Voc=50.6, Imp=13.00, Isc=13.85, L=2.278, W=1.134, bVoc=-0.25, bP=-0.30, bVmp=-0.30, bIsc=0.046)
mod['area']=mod['L']*mod['W']; mod['eff']=mod['Pmax']/(mod['area']*1000)*100
D['mod']=mod

# ---------- Layout ----------
lat=30.34; decl=23.44
alt = 90-lat-decl
tilt=25.0
h = mod['L']*math.sin(math.radians(tilt))
proj = mod['L']*math.cos(math.radians(tilt))
shadow = h/math.tan(math.radians(alt))
pitch_min = proj+shadow
pitch = 3.5
per_row = 6
row_w = per_row*mod['W'] + (per_row-1)*0.02
depth = proj + pitch
env_w = row_w+1.2
env_d = depth+1.2
env_area = env_w*env_d
mod_area_total = n_mod*mod['area']
D['layout']=dict(lat=lat,decl=decl,alt=alt,tilt=tilt,h=h,proj=proj,shadow=shadow,pitch_min=pitch_min,pitch=pitch,row_w=row_w,depth=depth,env_w=env_w,env_d=env_d,env_area=env_area,mod_area_total=mod_area_total,factor=env_area/mod_area_total, factor_lo=1.5, factor_hi=1.8, need_lo=mod_area_total*1.5, need_hi=mod_area_total*1.8)

# ---------- Strings ----------
Tmin=-5; Tcell=70
n_s=6; n_str=2
Voc_cold = mod['Voc']*(1+abs(mod['bVoc'])/100*(25-Tmin))
Vmp_hot = mod['Vmp']*(1+mod['bVmp']/100*(Tcell-25))
Vmp_cold = mod['Vmp']*(1+abs(mod['bVmp'])/100*(25-Tmin))
D['str']=dict(Tmin=Tmin,Tcell=Tcell,n_s=n_s,n_str=n_str,Voc_cold=Voc_cold,Vmp_hot=Vmp_hot,Vmp_cold=Vmp_cold,
  S_Voc_stc=n_s*mod['Voc'],S_Vmp_stc=n_s*mod['Vmp'],S_Voc_cold=n_s*Voc_cold,S_Vmp_hot=n_s*Vmp_hot,S_Vmp_cold=n_s*Vmp_cold,
  S_P=n_s*mod['Pmax'], Imax=1.25*mod['Isc'])
inv_kW = 6.0
D['inv']=dict(kW=inv_kW,dcac=kWp/inv_kW, Iac=inv_kW*1000/(math.sqrt(3)*415), )
D['inv']['Iac125']=D['inv']['Iac']*1.25

# ---------- Essential load & battery ----------
ess = [("Ceiling fans","4 of 6 fans",0.075,10.0,4*0.075*10.0),("Refrigerator","1 unit",0.20,9.0,0.20*9.0),("Water pump (restricted use)","1 unit",0.75,1.0,0.75*1.0),("LED lighting","12 lamps",0.012,5.0,12*0.012*5.0),("TV and set-top box","1 set",0.10,3.0,0.10*3.0),("Wi-Fi router, laptops, chargers","Lumped",0.20,8.0,0.20*8.0)]
E_ess = sum(e[4] for e in ess)
days_bk=7
E_bk = E_ess*days_bk
DoD=0.90; eta=0.92; age=0.90
cap_req = E_bk/(DoD*eta*age)
mod_kWh=5.12
n_bat=math.ceil(cap_req/mod_kWh)
cap_sel=n_bat*mod_kWh
usable_BOL = cap_sel*DoD*eta
usable_EOL = usable_BOL*age
D['ess']=ess; D['E_ess']=E_ess; D['E_bk']=E_bk
D['bat']=dict(DoD=DoD,eta=eta,age=age,cap_req=cap_req,cap_nodera=E_bk/(DoD*eta),n_bat=n_bat,mod_kWh=mod_kWh,cap_sel=cap_sel,usable_BOL=usable_BOL,usable_EOL=usable_EOL,days_BOL=usable_BOL/E_ess,days_EOL=usable_EOL/E_ess)
# full house
E_fh = E_day*days_bk
cap_fh = E_fh/(DoD*eta*age)
D['fh']=dict(E_fh=E_fh,cap_fh=cap_fh,ratio=cap_fh/cap_sel, share=E_ess/E_day)
# recharge
E_drawn = E_bk/eta
chg_eff=0.95
E_pv_needed = E_drawn/chg_eff
grid_kW=5.0
D['rech']=dict(E_drawn=E_drawn,E_pv_needed=E_pv_needed,grid_kW=grid_kW,t_grid=E_pv_needed/grid_kW)
sur = [ (g-l)/d for g,l,d in zip(mgen,mload,days)]
D['rech']['sur_daily']=sur
D['rech']['t_solar']=[ (E_pv_needed/s if s>0 else None) for s in sur]

# ---------- Cost ----------
tar1=3.85; tar2=7.05
bill=[]
for L in mload:
    b = min(L,300)*tar1 + max(0,L-300)*tar2
    bill.append(b)
bill_year=sum(bill)
D['tariff']=dict(t1=tar1,t2=tar2,bill=bill,bill_year=bill_year)

c = {}
c['modules']=n_mod*mod_W*25
c['structure']=kWp*1000*5
c['inv_hyb']=120000
c['battery']=cap_sel*22000
c['dc']=24000; c['ac']=36000; c['earth']=18000; c['encl']=45000; c['netm']=15000; c['labour']=60000
tot_hyb = c['modules']+c['structure']+c['inv_hyb']+c['battery']+c['dc']+c['ac']+c['earth']+c['encl']+c['netm']+c['labour']
# PV only
c['inv_ong']=70000; c['ac_o']=30000; c['labour_o']=45000
tot_pv = c['modules']+c['structure']+c['inv_ong']+c['dc']+c['ac_o']+c['earth']+c['netm']+c['labour_o']
subs=78000
D['cost']=dict(c=c,tot_hyb=tot_hyb,tot_pv=tot_pv,subs=subs,batt_share=c['battery']/tot_hyb,
  pb_hyb=tot_hyb/bill_year, pb_pv=tot_pv/bill_year, pb_hyb_s=(tot_hyb-subs)/bill_year, pb_pv_s=(tot_pv-subs)/bill_year,
  incr=tot_hyb-tot_pv, cost_kwh=c['battery']/cap_sel)
json.dump(D, open('calc.json','w'), indent=1, default=float)

# print key numbers
def p(k,v): print(k, v)
p('plot',plot); p('foot',foot); p('W_roof',W_roof); p('inner',inner); p('usable',usable)
p('E_day',E_day); p('base',base_day); p('coinc',coinc); p('design_peak',design_peak); p('conn',conn)
p('daily_load',[round(x,2) for x in daily_load]); p('mload',[round(x) for x in mload]); p('E_year',E_year)
p('psh_avg',psh_avg); p('GTI_year',GTI_year); p('PR_calc',PR_calc)
p('pv_peakday',pv_peakday); p('pv_annual',pv_annual); p('kWp',kWp)
p('gen_daily',[round(x,1) for x in gen_daily]); p('mgen',[round(x) for x in mgen]); p('G_year',G_year); p('cover',G_year/E_year); p('spec',G_year/kWp)
p('net',[round(x) for x in D['net_m']]); p('net_year',D['net_year'])
p('mod area/eff',(mod['area'],mod['eff']))
p('layout',D['layout'])
p('str',D['str']); p('inv',D['inv'])
p('E_ess',E_ess); p('E_bk',E_bk); p('bat',D['bat']); p('fh',D['fh']); p('rech',{k:(v if not isinstance(v,list) else [round(x,1) if x else None for x in v]) for k,v in D['rech'].items()})
p('bill',[round(b) for b in bill]); p('bill_year',bill_year)
p('cost',D['cost'])
