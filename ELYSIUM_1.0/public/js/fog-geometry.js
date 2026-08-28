export function rectOverlap(a,b){
    return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
}

export function subtractRect(rect,cut){
    if(!rectOverlap(rect,cut))return[rect];
    const rx2=rect.x+rect.w,ry2=rect.y+rect.h;
    const cx1=Math.max(rect.x,cut.x),cy1=Math.max(rect.y,cut.y);
    const cx2=Math.min(rx2,cut.x+cut.w),cy2=Math.min(ry2,cut.y+cut.h);
    const pieces=[];
    if(cy1>rect.y)pieces.push({x:rect.x,y:rect.y,w:rect.w,h:cy1-rect.y});
    if(cy2<ry2)pieces.push({x:rect.x,y:cy2,w:rect.w,h:ry2-cy2});
    const middleH=cy2-cy1;
    if(middleH>0&&cx1>rect.x)pieces.push({x:rect.x,y:cy1,w:cx1-rect.x,h:middleH});
    if(middleH>0&&cx2<rx2)pieces.push({x:cx2,y:cy1,w:rx2-cx2,h:middleH});
    return pieces.filter(p=>p.w>0&&p.h>0);
}

export function raySegment(o,dir,w){
    const v1={x:o.x-w.x1,y:o.y-w.y1};
    const v2={x:w.x2-w.x1,y:w.y2-w.y1};
    const v3={x:-dir.y,y:dir.x};
    const dot=v2.x*v3.x+v2.y*v3.y;
    if(Math.abs(dot)<1e-8)return null;
    const t1=(v2.x*v1.y-v2.y*v1.x)/dot;
    const t2=(v1.x*v3.x+v1.y*v3.y)/dot;
    if(t1>=0&&t2>=0&&t2<=1)return{x:o.x+dir.x*t1,y:o.y+dir.y*t1,d:t1};
    return null;
}

export function visionBlockingWalls(walls=[]){
    return walls.filter(w=>w.blocks_vision&&!(w.wall_type!=="wall"&&w.door_state==="open"));
}

export function computeVisionPolygon(token,walls=[],bounds=null){
    if(!token||!token.vision_enabled)return[];
    const ox=token.x+token.width/2,oy=token.y+token.height/2;
    const range=Math.max(0,Number(token.vision_range)||0);
    if(!range)return[];
    const boundaryWalls = bounds && Number(bounds.width)>0 && Number(bounds.height)>0 ? [
        {x1:0,y1:0,x2:Number(bounds.width),y2:0,wall_type:"wall",door_state:"closed",blocks_vision:1},
        {x1:Number(bounds.width),y1:0,x2:Number(bounds.width),y2:Number(bounds.height),wall_type:"wall",door_state:"closed",blocks_vision:1},
        {x1:Number(bounds.width),y1:Number(bounds.height),x2:0,y2:Number(bounds.height),wall_type:"wall",door_state:"closed",blocks_vision:1},
        {x1:0,y1:Number(bounds.height),x2:0,y2:0,wall_type:"wall",door_state:"closed",blocks_vision:1}
    ] : [];
    const blockers=visionBlockingWalls([...walls,...boundaryWalls]),angles=[];
    for(let i=0;i<128;i++)angles.push(i/128*Math.PI*2);
    for(const w of blockers){
        for(const p of [{x:w.x1,y:w.y1},{x:w.x2,y:w.y2}]){
            const a=Math.atan2(p.y-oy,p.x-ox);
            angles.push(a-.0002,a,a+.0002);
        }
    }
    return angles.map(a=>{
        let best={x:ox+Math.cos(a)*range,y:oy+Math.sin(a)*range,d:range};
        for(const w of blockers){
            const hit=raySegment({x:ox,y:oy},{x:Math.cos(a),y:Math.sin(a)},w);
            if(hit&&hit.d<best.d)best=hit;
        }
        return best;
    }).sort((a,b)=>Math.atan2(a.y-oy,a.x-ox)-Math.atan2(b.y-oy,b.x-ox));
}

export function normalizeFogShape(shape){
    if(!shape||typeof shape!=="object")return null;
    if(Array.isArray(shape.points)){
        const points=shape.points.filter(p=>Number.isFinite(Number(p?.x))&&Number.isFinite(Number(p?.y))).map(p=>({x:Number(p.x),y:Number(p.y)}));
        return points.length>=3?{type:"polygon",points}:null;
    }
    const x=Number(shape.x),y=Number(shape.y),w=Number(shape.w),h=Number(shape.h);
    if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)return null;
    return {type:"rect",x,y,w,h};
}

export function mergeFogSnapshots(local,incoming,{globalPending=false,globalGenerationAtStart=0,currentGlobalGeneration=0,explorerPending=false,explorerGenerationAtStart=0,currentExplorerGeneration=0}={}){
    const safeLocal=local||{global:{revealed:[],explored:[]},user:{revealed:[],explored:[]}};
    const safeIncoming=incoming||{global:{revealed:[],explored:[]},user:{revealed:[],explored:[]}};
    return {
        global:(globalPending||globalGenerationAtStart!==currentGlobalGeneration)?safeLocal.global:safeIncoming.global,
        user:(explorerPending||explorerGenerationAtStart!==currentExplorerGeneration)?safeLocal.user:safeIncoming.user
    };
}
