import json, math
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, Rectangle, FancyArrowPatch
D = json.load(open('calc.json'))
matplotlib.rcParams['font.family'] = 'Liberation Sans'
matplotlib.rcParams['axes.unicode_minus'] = False

NAVY="#1F3864"; BLUE="#2E75B6"; ORANGE="#C55A11"; GREY="#595959"; LIGHT="#EAF1FB"; LORANGE="#FDF0E6"; LGREEN="#E8F3E8"; GREEN="#3B7D3B"

# ---------------- Figure 1: block diagram ----------------
fig, ax = plt.subplots(figsize=(8.4, 7.0), dpi=220)
ax.set_xlim(0,100); ax.set_ylim(-3.5,68); ax.axis('off')

def box(x,y,w,h,title,sub,fc,ec,tc=NAVY,tsize=11.0,ssize=9.8):
    p = FancyBboxPatch((x,y),w,h,boxstyle="round,pad=0.3,rounding_size=1.2",fc=fc,ec=ec,lw=1.6)
    ax.add_patch(p)
    ax.text(x+w/2,y+h-3.0,title,ha='center',va='center',fontsize=tsize,fontweight='bold',color=tc)
    ax.text(x+w/2,y+(h-6)/2-0.3,sub,ha='center',va='center',fontsize=ssize,color=GREY,linespacing=1.45)

def arrow(p1,p2,col,style='-|>',lw=1.8):
    ax.add_patch(FancyArrowPatch(p1,p2,arrowstyle=style,mutation_scale=13,lw=lw,color=col))

box(1,47,26,16,"Solar PV array","12 \u00d7 550 W = 6.6 kWp\n2 strings \u00d7 6 modules",LORANGE,ORANGE)
box(35,47,26,16,"DC combiner box","DC isolator + SPD\n6 mm\u00b2 solar cable",LORANGE,ORANGE)
box(31,20,34,20,"6 kW 3-phase hybrid inverter","2 MPPT \u00b7 PLL grid sync\nanti-islanding \u00b7 backup port\nbattery charger \u00b7 EMS",LIGHT,BLUE,tsize=11.0)
box(1,3,26,17,"LiFePO4 battery bank","15 \u00d7 5.12 kWh = 76.8 kWh\nBMS with CAN link\nDC breaker \u00b7 fire-rated\nenclosure",LGREEN,GREEN)
box(35,3,26,13,"Essential-load panel","fans \u00b7 fridge \u00b7 pump\nlights \u00b7 IT \u00b7 TV",LIGHT,BLUE)
box(72,24,26,17,"AC distribution board","isolator \u00b7 MCB \u00b7 RCCB\nSPD \u00b7 essential /\nnon-essential split",LIGHT,BLUE)
box(72,3,26,14,"Non-essential loads","3 ACs \u00b7 kitchen\nwashing machine \u00b7 others",LIGHT,BLUE)
box(72,47,26,12,"Bidirectional net meter","import / export",LIGHT,BLUE,tsize=10.6)
ax.text(85,64.6,"PSPCL grid, 415 V / 50 Hz",ha='center',va='center',fontsize=10,fontweight='bold',color=NAVY)

arrow((27.6,55),(34.4,55),ORANGE)
arrow((48,46.6),(48,40.6),ORANGE)
ax.text(50,43.6,"DC",fontsize=9,color=ORANGE,fontweight='bold')
arrow((14,20.6),(30.6,26),GREEN,style='<|-|>')
ax.text(2,27.5,"battery port (DC)",fontsize=9,color=GREEN,fontweight='bold')
arrow((48,19.4),(48,16.6),BLUE)
ax.text(50,17.7,"backup port (AC)",fontsize=9,color=BLUE,fontweight='bold')
arrow((65.6,31),(71.4,31),BLUE,style='<|-|>')
ax.text(68.5,34.0,"grid port\n(AC)",fontsize=7.4,color=BLUE,fontweight="bold",ha="center",va="center")
arrow((85,23.4),(85,17.6),BLUE)
arrow((85,41.6),(85,46.4),BLUE,style='<|-|>')
arrow((85,59.6),(85,63.0),BLUE,style='<|-|>')

ax.plot([1,6],[-1.2,-1.2],color=ORANGE,lw=2); ax.text(7,-1.2,"DC power",fontsize=9,va='center',color=GREY)
ax.plot([26,31],[-1.2,-1.2],color=BLUE,lw=2); ax.text(32,-1.2,"AC power",fontsize=9,va='center',color=GREY)
ax.plot([50,55],[-1.2,-1.2],color=GREEN,lw=2); ax.text(56,-1.2,"Battery DC (two-way)",fontsize=9,va='center',color=GREY)
plt.savefig('fig_block.png',bbox_inches='tight',facecolor='white'); plt.close()

# ---------------- Figure 2: roof plan ----------------
S = D['site']; Ly = D['layout']; m = D['mod']
fig, ax = plt.subplots(figsize=(7.6, 5.5), dpi=220)
Lx, Wy = S['L'], S['W']
ax.set_xlim(-1.2, Lx+1.2); ax.set_ylim(-1.6, Wy+1.6); ax.set_aspect('equal'); ax.axis('off')
ax.add_patch(Rectangle((0,0),Lx,Wy,fc='#F2F2F2',ec='#404040',lw=2.2))
sb = S['setb']
ax.add_patch(Rectangle((sb,sb),Lx-2*sb,Wy-2*sb,fc='white',ec=GREY,lw=1.1,ls='--'))
ax.text(Lx/2, Wy-0.32, "parapet / 0.6 m setback", ha='center', va='center', fontsize=7, color=GREY)
# mumty and tank
ax.add_patch(Rectangle((11.3,5.63),3.1,3.87,fc='#BFBFBF',ec='#404040',lw=1.4)); ax.text(12.85,7.5,"Mumty\n3.1 x 3.9 m",ha='center',va='center',fontsize=8)
ax.add_patch(Rectangle((8.8,7.0),2.4,2.5,fc='#9DC3E6',ec='#404040',lw=1.4)); ax.text(10.0,8.25,"Water\ntanks",ha='center',va='center',fontsize=8)
# shadow buffer hatch (south of mumty and tanks)
ax.add_patch(Rectangle((11.3,4.63),3.1,1.0,fc='none',ec='#7F7F7F',hatch='////',lw=0.6))
ax.add_patch(Rectangle((8.8,6.0),2.4,1.0,fc='none',ec='#7F7F7F',hatch='////',lw=0.6))
ax.text(12.85,4.15,"shadow buffer",ha='center',va='center',fontsize=7,color=GREY)
# array
x0=1.2; y0=1.3; mw=m['W']; dep=Ly['proj']
for r in range(2):
    yy = y0 + r*Ly['pitch']
    for c in range(6):
        ax.add_patch(Rectangle((x0+c*(mw+0.02),yy),mw,dep,fc='#1F3864',ec='white',lw=0.8))
ax.text(x0+Ly['row_w']/2, y0+dep/2, "Row 1: 6 modules (String 1)", ha='center', va='center', color='white', fontsize=8)
ax.text(x0+Ly['row_w']/2, y0+Ly['pitch']+dep/2, "Row 2: 6 modules (String 2)", ha='center', va='center', color='white', fontsize=8)
# pitch dimension
xd = x0+Ly['row_w']+0.5
ax.annotate("",xy=(xd,y0+Ly['pitch']),xytext=(xd,y0),arrowprops=dict(arrowstyle='<->',color=ORANGE,lw=1.3))
ax.text(xd+0.15,y0+Ly['pitch']/2,"row pitch\n3.5 m",fontsize=8,color=ORANGE,va='center')
# walkway envelope
ax.add_patch(Rectangle((x0-0.6,y0-0.6),Ly['env_w'],Ly['env_d'],fc='none',ec=ORANGE,lw=1.3,ls=':'))
ax.text(x0-0.55,y0+Ly['env_d']-0.35,"array envelope incl. 0.6 m walkway: %.1f m2"%Ly['env_area'],fontsize=7.5,color=ORANGE,va='center')
# free area label
ax.text(12.0,2.0,"Free roof area retained\nfor future expansion\nand access",ha='center',va='center',fontsize=8.5,color=GREEN)
# north arrow
ax.annotate("",xy=(Lx+0.6,Wy-0.4),xytext=(Lx+0.6,Wy-2.3),arrowprops=dict(arrowstyle='-|>',color='black',lw=1.6))
ax.text(Lx+0.6,Wy-0.05,"N",ha='center',fontsize=11,fontweight='bold')
# dims
ax.annotate("",xy=(0,-0.7),xytext=(Lx,-0.7),arrowprops=dict(arrowstyle='<->',color='black',lw=1))
ax.text(Lx/2,-1.15,"%.1f m (east-west)"%Lx,ha='center',fontsize=8.5)
ax.annotate("",xy=(-0.7,0),xytext=(-0.7,Wy),arrowprops=dict(arrowstyle='<->',color='black',lw=1))
ax.text(-0.95,Wy/2,"%.2f m (north-south)"%Wy,rotation=90,va='center',ha='center',fontsize=8.5)
ax.text(Lx/2,-1.5,"South parapet (front of array)",ha='center',fontsize=7.5,color=GREY)
plt.savefig('fig_roof.png',bbox_inches='tight',facecolor='white'); plt.close()

# ---------------- Figure 3: monthly energy ----------------
mo = D['months']; L = D['mload']; G = D['mgen']
fig, ax = plt.subplots(figsize=(8.0, 3.8), dpi=220)
import numpy as np
x = np.arange(12); w=0.38
ax.bar(x-w/2, L, w, label="Household load", color="#8FAADC")
ax.bar(x+w/2, G, w, label="PV generation (6.6 kWp)", color="#ED7D31")
ax.set_xticks(x); ax.set_xticklabels(mo)
ax.set_ylabel("Energy (kWh per month)")
ax.grid(axis='y',alpha=0.3); ax.set_axisbelow(True)
for s in ['top','right']: ax.spines[s].set_visible(False)
ax.legend(frameon=False, loc='upper right', ncol=2, bbox_to_anchor=(1.0,1.12))
plt.savefig('fig_monthly.png',bbox_inches='tight',facecolor='white'); plt.close()
print("figs done")
