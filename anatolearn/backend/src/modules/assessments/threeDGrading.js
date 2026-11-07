const FORMATS = ['region_identification', 'annotation_matching'];
const finite = n => typeof n === 'number' && Number.isFinite(n);
function valid3DAnswer(question, value) {
  if (value == null) return true; // Timeout allows an unanswered question, graded zero.
  if (question.format === 'region_identification') return Array.isArray(value.points) && value.points.length <= 256 &&
    value.points.every(p => p && finite(p.x) && finite(p.y) && finite(p.z) && Math.abs(p.x) < 1e7 && Math.abs(p.y) < 1e7 && Math.abs(p.z) < 1e7);
  if (question.format === 'annotation_matching') return value.matches && !Array.isArray(value.matches) &&
    typeof value.matches === 'object' && Object.keys(value.matches).length <= 12 &&
    Object.entries(value.matches).every(([k,v]) => /^\d{1,6}$/.test(k) && typeof v === 'string' && v.length <= 255);
  return false;
}
function quaternionXYZ(o) {
  const x=(o.x||0)/2,y=(o.y||0)/2,z=(o.z||0)/2;
  const a=Math.sin(x),b=Math.sin(y),c=Math.sin(z),d=Math.cos(x),e=Math.cos(y),f=Math.cos(z);
  return {x:a*e*f+d*b*c,y:d*b*f-a*e*c,z:d*e*c+a*b*f,w:d*e*f-a*b*c};
}
function toProjector(p, mask) {
  const {position, orientation, size}=mask;
  const q=quaternionXYZ(orientation);
  let v={x:p.x-position.x,y:p.y-position.y,z:p.z-position.z};
  // Inverse quaternion rotation: v + 2*w*(u x v) + 2*(u x (u x v)).
  const u={x:-q.x,y:-q.y,z:-q.z};
  const t={x:2*(u.y*v.z-u.z*v.y),y:2*(u.z*v.x-u.x*v.z),z:2*(u.x*v.y-u.y*v.x)};
  v={x:v.x+q.w*t.x+(u.y*t.z-u.z*t.y),y:v.y+q.w*t.y+(u.z*t.x-u.x*t.z),z:v.z+q.w*t.z+(u.x*t.y-u.y*t.x)};
  return {x:0.5+v.x/size.x,y:0.5-v.y/size.y};
}
function inside(p, polygon) {
  let yes=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const a=polygon[i],b=polygon[j];
    if(((a.y>p.y)!==(b.y>p.y)) && p.x<((b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))yes=!yes;
  }
  return yes;
}
function gradeRegion(reference, answer) {
  const mask=reference?.projectedMask;
  const actual=answer?.points||[];
  if (!mask || mask.mode!=='fill' || !Array.isArray(mask.maskPoints) || mask.maskPoints.length<3 || actual.length<3)
    return {score:0, correct:false, details:{iou:0,coverage:0,precision:0}};
  const student=actual.map(p=>toProjector(p,mask));
  const truth=mask.maskPoints;
  let overlap=0,truthCount=0,studentCount=0;
  // Fixed full viewport with margin penalizes painting outside the teacher reference.
  for(let y=-0.5;y<1.5;y+=0.025)for(let x=-0.5;x<1.5;x+=0.025){
    const p={x:x+0.0125,y:y+0.0125};
    const t=inside(p,truth),s=inside(p,student);
    if(t)truthCount++;
    if(s)studentCount++;
    if(t&&s)overlap++;
  }
  const union=truthCount+studentCount-overlap;
  const iou=union?overlap/union:0,coverage=truthCount?overlap/truthCount:0,precision=studentCount?overlap/studentCount:0;
  const details={iou:Math.round(iou*100),coverage:Math.round(coverage*100),precision:Math.round(precision*100)};
  return {score:details.iou,correct:iou>=0.70 && coverage>=0.80 && precision>=0.80,details};
}
function gradeMatching(key, answer) {
  const labels=Object.entries(key||{});
  const matches=answer?.matches||{};
  const matched=labels.filter(([id,label])=>matches[id]===label).length;
  const score=labels.length?Math.round(matched/labels.length*100):0;
  return {score,correct:labels.length>0 && matched===labels.length,details:{matched,total:labels.length}};
}
module.exports = {FORMATS,valid3DAnswer,gradeRegion,gradeMatching,toProjector};
