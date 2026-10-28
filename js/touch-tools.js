/* LayoutCAD Pro: touch tools, movable view dimensions, visibility and collapsible panels.
   Dimensions are view annotations; they are not yet native DXF DIMENSION entities. */
(()=>{
'use strict';
let active=false,start=null,preview=null,cursorPoint=null,measures=[],dragging=null,pointers=new Map(),pinch=null,dimensionsVisible=true,dimPhase=0,placementPoint=null,undoStack=[];
try{measures=JSON.parse(localStorage.getItem('layoutcad-dimensions-v6')||'[]');}catch(_){measures=[];}
function saveMeasures(){try{localStorage.setItem('layoutcad-dimensions-v6',JSON.stringify(measures));}catch(_){}}
function pushUndo(){undoStack.push(JSON.stringify(measures));if(undoStack.length>50)undoStack.shift();}
const $=id=>document.getElementById(id);
window.closePartPopup=()=>{window.partPopupPinned=false;$('rowHoverTooltip')?.classList.add('hidden');$('rowHoverTooltip')?.classList.remove('part-popup-touch');};
window.enhancePartPopup=()=>{const el=$('rowHoverTooltip');if(!el)return;if(!$('closePartPopup')){const b=document.createElement('button');b.id='closePartPopup';b.type='button';b.textContent='×';b.setAttribute('aria-label','Đóng popup');b.style.cssText='position:sticky;float:right;top:0;z-index:20;font-size:24px;line-height:1;padding:4px 10px;background:#172033;border:1px solid #475569;border-radius:8px;color:white';b.onclick=e=>{e.stopPropagation();closePartPopup();};el.prepend(b);}};
document.addEventListener('pointerdown',e=>{if(window.partPopupPinned&&!e.target.closest('#rowHoverTooltip')&&!e.target.closest('#excelTableBody'))closePartPopup();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closePartPopup();if(active)toggleMeasure();return;}if(e.code==='Space'&&active&&!/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||'')){e.preventDefault();if(dimPhase===0)commitPoint(1);else if(dimPhase===1)commitPoint(2);else finalizePlacement();}if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undoMeasure();}if(e.key.toLowerCase()==='f'&&!e.ctrlKey){window.resetCanvasView?.();}});
function info(s){if($('measureInfo'))$('measureInfo').textContent=s;}
function snap(p){
 if(!$('dimSnap')?.checked)return p;
 const t=window.cadMeasureTransform;if(!t)return p;
 // Snap only to actual CAD vertices, segment midpoints and true wall crossings; never to an artificial grid.
 const candidates=[];
 try{const g=computeCadGeometry();const x0=g.offX+g.bX,x1=g.L-g.offX-g.bX,y0=g.offY+g.bY,y1=g.W-g.offY-g.bY;const add=(x,y,type)=>candidates.push({x,y,type});
  [[0,0],[g.L,0],[g.L,g.W],[0,g.W],[x0,y0],[x1,y0],[x1,y1],[x0,y1]].forEach(q=>add(q[0],q[1],'endpoint'));
  const tx=Math.max(0,Number(g.tX)||0),ty=Math.max(0,Number(g.tY)||0);
  // Snap to both faces of each finite-thickness wall, not only its centreline.
  g.vWalls.forEach(x=>{[x-tx/2,x,x+tx/2].forEach((xx,face)=>{add(xx,y0,'endpoint');add(xx,y1,'endpoint');add(xx,(y0+y1)/2,'midpoint');});});
  g.hWalls.forEach(y=>{[y-ty/2,y,y+ty/2].forEach(yy=>{add(x0,yy,'endpoint');add(x1,yy,'endpoint');add((x0+x1)/2,yy,'midpoint');});});
  g.vWalls.forEach(x=>g.hWalls.forEach(y=>{[x-tx/2,x,x+tx/2].forEach(xx=>[y-ty/2,y,y+ty/2].forEach(yy=>add(xx,yy,'intersection')));}));
 }catch(_){}
 let best=null,bestD=24/Math.max(.0001,t.scale);for(const q of candidates){const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<bestD){best=q;bestD=d;}}
 window._cadSnapPoint=best?{x:best.x,y:best.y,type:best.type}:null;return best?{x:best.x,y:best.y}:p;
}
function point(e){const r=$('canvasContainer').getBoundingClientRect(),t=window.cadMeasureTransform;if(!t)return null;return snap({x:(e.clientX-r.left-t.originX)/t.scale,y:(e.clientY-r.top-t.originY)/t.scale});}
function screen(p,t){return{x:t.originX+p.x*t.scale,y:t.originY+p.y*t.scale};}
function geometry(m){const mode=m.mode||'aligned';if(mode==='horizontal')return[{x:m.a.x,y:m.a.y},{x:m.b.x,y:m.a.y}];if(mode==='vertical')return[{x:m.a.x,y:m.a.y},{x:m.a.x,y:m.b.y}];return[m.a,m.b];}
function labelBox(m,t,c){const [a,b]=geometry(m),A=screen(a,t),B=screen(b,t),mid={x:(A.x+B.x)/2,y:(A.y+B.y)/2};const dist=Math.hypot(b.x-a.x,b.y-a.y),label=dist.toFixed(2)+' mm';c.font='bold 13px sans-serif';const w=c.measureText(label).width+18;const off=m.labelOffset||{x:0,y:-18};return{x:Math.max(2,Math.min(t.width-w,mid.x-w/2+off.x)),y:Math.max(22,Math.min(t.height-3,mid.y+off.y)),w,h:25,label,dist,A,B,mid};}
window.setDimensionsVisible=v=>{dimensionsVisible=!!v;redrawMeasures();};
window.toggleMeasure=()=>{if(window.APP_STATE?.viewMode==='3d'){info('Chuyển sang View 2D để tạo DIM.');return;}active=!active;start=null;preview=null;dimPhase=0;placementPoint=null;$('measureToggle')?.classList.toggle('measuring',active);$('canvasContainer')?.classList.toggle('measure-active',active);['confirmDimPoint1','confirmDimPoint2','confirmDimPlacement'].forEach(id=>{const b=$(id);if(b)b.disabled=!active;});info(active?'DIM: chọn điểm đầu, nhấn Space; chọn điểm cuối, nhấn Space; đặt vị trí nhãn rồi nhấn Space lần nữa.':'Đã tắt công cụ DIM.');redrawMeasures();};
function commitPoint(which){if(!active)return;if(!cursorPoint){info('Di chuyển chuột hoặc chạm bản vẽ để chọn điểm.');return;}const t=window.cadMeasureTransform;if(!t)return;const p=snap({x:(cursorPoint.x-t.originX)/t.scale,y:(cursorPoint.y-t.originY)/t.scale});if(which===1){start=p;preview=p;dimPhase=1;info('Đã chọn điểm 1. Chọn điểm 2 rồi nhấn Space hoặc nút ②.');redrawMeasures();return;}if(!start){info('Hãy chọn điểm 1 trước.');return;}const m={a:start,b:p,mode:$('dimMode')?.value||'aligned',labelOffset:{x:0,y:-28},hidden:false};pushUndo();measures.push(m);dimPhase=2;placementPoint={x:0,y:-28};preview=p;info('Đã tạo đường DIM tạm. Di chuyển đến vị trí đặt nhãn rồi nhấn Space hoặc nút “Đặt DIM”.');redrawMeasures();}
window.confirmDimPoint=(which)=>{if(which===1){commitPoint(1);return;}if(which===2){if(dimPhase===2){finalizePlacement();return;}commitPoint(2);}};
window.confirmDimPlacement=()=>finalizePlacement();
function finalizePlacement(){if(!active||dimPhase!==2||!measures.length)return;const m=measures[measures.length-1],t=window.cadMeasureTransform;if(cursorPoint&&t){const [a,b]=geometry(m),A=screen(a,t),B=screen(b,t),mid={x:(A.x+B.x)/2,y:(A.y+B.y)/2};m.labelOffset={x:cursorPoint.x-mid.x,y:cursorPoint.y-mid.y};}saveMeasures();start=null;preview=null;dimPhase=0;placementPoint=null;info('Đã đặt DIM. Nhấn Space để bắt đầu DIM tiếp theo.');redrawMeasures();}
window.undoMeasure=()=>{if(undoStack.length){measures=JSON.parse(undoStack.pop());}else measures.pop();saveMeasures();start=null;preview=null;dimPhase=0;redrawMeasures();info('Đã hoàn tác thao tác DIM.');};
window.clearMeasures=()=>{pushUndo();measures=[];saveMeasures();start=null;preview=null;dimPhase=0;redrawMeasures();info('Đã xóa toàn bộ DIM.');};
window.redrawMeasures=()=>{const o=$('measureOverlay'),base=$('cadCanvas'),t=window.cadMeasureTransform;if(!o||!base||!t)return;o.width=base.width;o.height=base.height;const c=o.getContext('2d'),dpr=base.width/Math.max(1,t.width);c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,t.width,t.height);if(dimensionsVisible){measures.forEach((m,i)=>{const [a,b]=geometry(m),A=screen(a,t),B=screen(b,t),box=labelBox(m,t,c),col=m.hidden?'#64748b':'#38bdf8';c.save();c.globalAlpha=m.hidden?.35:1;c.strokeStyle=col;c.fillStyle=col;c.lineWidth=1.25;
 // CAD dimension line follows the user's label offset; extension lines connect the measured points.
 const off=m.labelOffset||{x:0,y:-18},vx=off.x,vy=off.y;
 const DA={x:A.x+vx,y:A.y+vy},DB={x:B.x+vx,y:B.y+vy};
 c.setLineDash([3,3]);c.beginPath();c.moveTo(A.x,A.y);c.lineTo(DA.x,DA.y);c.moveTo(B.x,B.y);c.lineTo(DB.x,DB.y);c.stroke();c.setLineDash([]);
 c.beginPath();c.moveTo(DA.x,DA.y);c.lineTo(DB.x,DB.y);c.stroke();
 const al=7,aw=3,dx=DB.x-DA.x,dy=DB.y-DA.y,len=Math.max(1,Math.hypot(dx,dy)),ux=dx/len,uy=dy/len,nx=-uy,ny=ux;
 [[DA.x,DA.y,1],[DB.x,DB.y,-1]].forEach(([x,y,sgn])=>{c.beginPath();c.moveTo(x,y);c.lineTo(x+sgn*ux*al+nx*aw,y+sgn*uy*al+ny*aw);c.lineTo(x+sgn*ux*al-nx*aw,y+sgn*uy*al-ny*aw);c.closePath();c.fill();});
 c.fillStyle='rgba(3,9,20,.96)';c.fillRect(box.x,box.y-19,box.w,25);c.strokeStyle=col;c.strokeRect(box.x,box.y-19,box.w,25);c.fillStyle='#f8fafc';c.font='bold 13px sans-serif';c.fillText(box.label,box.x+9,box.y-2);c.fillStyle='#94a3b8';c.font='10px sans-serif';c.fillText('DIM '+(i+1),box.x+2,box.y+18);c.restore();});}if(start&&preview){const m={a:start,b:preview,mode:$('dimMode')?.value||'aligned'},[a,b]=geometry(m),A=screen(a,t),B=screen(b,t);c.save();c.strokeStyle='#fbbf24';c.setLineDash([6,4]);c.lineWidth=2;c.beginPath();c.moveTo(A.x,A.y);c.lineTo(B.x,B.y);c.stroke();c.restore();}
 // Cursor magnifier, similar to CAD point-pick loupe.
 if(active&&cursorPoint){const dpr=base.width/Math.max(1,t.width),cx=cursorPoint.x,cy=cursorPoint.y,R=58,zoom=3.2,lx=Math.min(t.width-R-8,Math.max(R+8,cx+90)),ly=Math.min(t.height-R-8,Math.max(R+8,cy+78));
 c.save();c.beginPath();c.arc(lx,ly,R,0,Math.PI*2);c.clip();c.fillStyle='rgba(3,9,20,.98)';c.fillRect(lx-R,ly-R,R*2,R*2);
 const sw=R*2/zoom,sh=R*2/zoom,sx=Math.max(0,Math.min(base.width-sw*dpr,(cx-sw/2)*dpr)),sy=Math.max(0,Math.min(base.height-sh*dpr,(cy-sh/2)*dpr));
 try{c.drawImage(base,sx,sy,sw*dpr,sh*dpr,lx-R,ly-R,R*2,R*2);}catch(_){}
 c.strokeStyle='#38bdf8';c.lineWidth=2;c.beginPath();c.moveTo(lx-R,ly);c.lineTo(lx+R,ly);c.moveTo(lx,ly-R);c.lineTo(lx,ly+R);c.stroke();c.restore();c.strokeStyle=window._cadSnapPoint?'#4ade80':'#38bdf8';c.lineWidth=2;c.beginPath();c.arc(lx,ly,R,0,Math.PI*2);c.stroke();
 c.fillStyle=window._cadSnapPoint?'#4ade80':'#e2e8f0';c.font='bold 10px sans-serif';c.fillText(window._cadSnapPoint?'SNAP '+window._cadSnapPoint.type.toUpperCase():'ZOOM PICK',Math.min(t.width-110,lx-R),Math.max(12,ly-R-5));
 }
 if(active&&window._cadSnapPoint){const q=screen(window._cadSnapPoint,t);c.save();c.strokeStyle='#4ade80';c.lineWidth=2;c.beginPath();c.moveTo(q.x-7,q.y);c.lineTo(q.x+7,q.y);c.moveTo(q.x,q.y-7);c.lineTo(q.x,q.y+7);c.stroke();c.strokeRect(q.x-4,q.y-4,8,8);c.restore();}
};
function nearestLabel(x,y){const t=window.cadMeasureTransform;if(!t)return-1;const c=$('measureOverlay').getContext('2d');for(let i=measures.length-1;i>=0;i--){const b=labelBox(measures[i],t,c);if(x>=b.x-6&&x<=b.x+b.w+6&&y>=b.y-22&&y<=b.y+9)return i;}return-1;}
function install(){const vp=$('canvasContainer'),o=$('measureOverlay');if(!vp||!o)return;
 o.addEventListener('pointerdown',e=>{const r=o.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top,idx=nearestLabel(x,y);if(idx>=0&&dimensionsVisible){pushUndo();dragging={idx,x,y,offset:{...(measures[idx].labelOffset||{x:0,y:-18})}};o.setPointerCapture?.(e.pointerId);e.preventDefault();e.stopPropagation();return;}if(active){cursorPoint={x,y};preview=start?point(e):null;info(start?'Định vị điểm 2 rồi nhấn nút ② Xác nhận điểm 2.':'Định vị điểm 1 rồi nhấn nút ① Xác nhận điểm 1.');redrawMeasures();e.preventDefault();e.stopPropagation();}},true);
 o.addEventListener('pointermove',e=>{const r=o.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;if(dragging){measures[dragging.idx].labelOffset={x:dragging.offset.x+x-dragging.x,y:dragging.offset.y+y-dragging.y};redrawMeasures();e.preventDefault();e.stopPropagation();return;}if(active){const r=o.getBoundingClientRect();cursorPoint={x:e.clientX-r.left,y:e.clientY-r.top};const t=window.cadMeasureTransform;if(t)snap({x:(cursorPoint.x-t.originX)/t.scale,y:(cursorPoint.y-t.originY)/t.scale});if(start)preview=point(e);redrawMeasures();e.preventDefault();e.stopPropagation();}},true);
 o.addEventListener('pointerup',e=>{if(dragging){dragging=null;saveMeasures();info('Đã đặt vị trí nhãn DIM.');e.preventDefault();e.stopPropagation();}},true);
 o.addEventListener('dblclick',e=>{const r=o.getBoundingClientRect(),idx=nearestLabel(e.clientX-r.left,e.clientY-r.top);if(idx>=0){measures[idx].hidden=!measures[idx].hidden;info(measures[idx].hidden?'Đã ẩn đường DIM này trong View 2D.':'Đã hiện lại đường DIM.');redrawMeasures();e.preventDefault();e.stopPropagation();}},true);
 // Single tap a dimension label toggles its visibility (dragging it remains available).
 o.addEventListener('click',e=>{if(dragging)return;const r=o.getBoundingClientRect(),idx=nearestLabel(e.clientX-r.left,e.clientY-r.top);if(idx>=0&&!active){measures[idx].hidden=!measures[idx].hidden;info(measures[idx].hidden?'Đã ẩn DIM trong View 2D.':'Đã hiện DIM trong View 2D.');redrawMeasures();e.preventDefault();e.stopPropagation();}},true);
 // Preserve touch pan/pinch behavior when DIM tool is inactive.
 vp.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse')return;pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2){const v=[...pointers.values()],r=vp.getBoundingClientRect(),cx=(v[0].x+v[1].x)/2-r.left,cy=(v[0].y+v[1].y)/2-r.top;pinch={distance:Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y),zoom:window.APP_STATE.zoom,cx,cy,panX:window.APP_STATE.panX,panY:window.APP_STATE.panY,midX:(v[0].x+v[1].x)/2,midY:(v[0].y+v[1].y)/2};}if(active)e.preventDefault();},{capture:true,passive:false});
 vp.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||!pointers.has(e.pointerId))return;const old=pointers.get(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});if(pointers.size===2&&pinch){const v=[...pointers.values()],d=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y),r=vp.getBoundingClientRect(),mx=(v[0].x+v[1].x)/2-r.left,my=(v[0].y+v[1].y)/2-r.top,newZoom=Math.max(.1,Math.min(20,pinch.zoom*d/Math.max(1,pinch.distance))),ratio=newZoom/Math.max(.0001,pinch.zoom);window.APP_STATE.zoom=newZoom;window.APP_STATE.panX=pinch.panX+(mx-pinch.cx)+(pinch.cx-(r.width/2))* (1-ratio);window.APP_STATE.panY=pinch.panY+(my-pinch.cy)+(pinch.cy-r.height/2-pinch.panY)*(1-ratio);renderMainCanvas();}else if(old){window.APP_STATE.panX+=e.clientX-old.x;window.APP_STATE.panY+=e.clientY-old.y;renderMainCanvas();}e.preventDefault();},{capture:true,passive:false});
 vp.addEventListener('pointerup',e=>{if(e.pointerType!=='mouse'){pointers.delete(e.pointerId);if(pointers.size<2)pinch=null;}},{capture:true});
 const aside=document.querySelector('main > aside');
 if(aside&&!$('sidebarCollapseToggle')){
   const head=document.createElement('div');head.className='sidebar-collapse-head';
   const toggle=document.createElement('button');toggle.id='sidebarCollapseToggle';toggle.type='button';toggle.className='touch-action-btn';toggle.innerHTML='◀ <span>Thu gọn bảng thông số</span>';toggle.setAttribute('aria-expanded','true');
   const body=document.createElement('div');body.id='sidebarFullBody';body.className='sidebar-full-body';
   while(aside.firstChild)body.appendChild(aside.firstChild);
   head.appendChild(toggle);aside.append(head,body);
   toggle.onclick=()=>{const closed=aside.classList.toggle('sidebar-collapsed');toggle.setAttribute('aria-expanded',String(!closed));toggle.innerHTML=closed?'▶':'◀ <span>Thu gọn bảng thông số</span>';toggle.title=closed?'Mở bảng thông số':'Thu gọn bảng thông số';const main=aside.parentElement;main?.classList.toggle('sidebar-overlay-mode',closed);};}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
