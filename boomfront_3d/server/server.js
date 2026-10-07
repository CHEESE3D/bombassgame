const express=require("express");
const http=require("http");
const {Server}=require("socket.io");
const path=require("path");
const crypto=require("crypto");

const app=express(),server=http.createServer(app),io=new Server(server,{cors:{origin:"*"}});
const PORT=process.env.PORT||3000;
app.use(express.static(path.join(__dirname,"../client")));
app.get("/health",(req,res)=>res.json({ok:true,game:"BOOMFRONT 3D"}));

const MAPS=[
 {id:"crater",name:"CRATER",desc:"Open arena + trenches"},
 {id:"dockyard",name:"DOCKYARD",desc:"Containers + ramps"},
 {id:"desert",name:"DUSTBOWL",desc:"Rocky desert + wrecks"}
];
const WEAPONS={1:{damage:20,speed:65,life:1.2},2:{damage:100,speed:28,life:3.2,radius:8},3:{damage:38,speed:48,life:1.8,radius:3}};
const rooms=new Map();
function code(){return crypto.randomBytes(3).toString("hex").toUpperCase()}
function makeRoom(publicRoom=true){
  let c=code();while(rooms.has(c))c=code();
  const r={code:c,name:"Squad "+c,map:"crater",public:publicRoom,max:12,players:new Map(),bullets:new Map(),votes:{},voting:false};
  rooms.set(c,r);return r;
}
function lobbyList(){return [...rooms.values()].filter(r=>r.public).map(r=>({code:r.code,name:r.name,players:r.players.size,max:r.max,map:MAPS.find(m=>m.id===r.map)?.name||r.map}))}
function playerPacket(p){return {id:p.id,name:p.name,x:p.x,y:0,z:p.z,rot:p.rot,hp:p.hp,score:p.score}}
function broadcast(r){io.to(r.code).emit("snapshot",{players:[...r.players.values()].map(playerPacket)})}
function nearestTarget(r,b){
  let best=null,bd=999;
  for(const p of r.players.values()){if(p.id===b.owner)continue;const d=Math.hypot(p.x-b.x,p.z-b.z);if(d<bd){bd=d;best=p}}
  return {p:best,d:bd};
}
function explosion(r,b){
  const radius=b.radius||0;if(!radius)return;
  io.to(r.code).emit("explosion",{x:b.x,y:b.y,z:b.z,radius});
  for(const p of r.players.values()){if(p.id===b.owner)continue;const d=Math.hypot(p.x-b.x,p.z-b.z);if(d<=radius){p.hp-=Math.max(10,Math.round(b.damage*(1-d/radius)));if(p.hp<=0)kill(r,p,b.owner)}}
}
function kill(r,victim,killerId){
  const killer=r.players.get(killerId);if(killer){killer.score++;killer.hp=Math.min(100,killer.hp+20)}
  const killerName=killer?.name||"WORLD";
  io.to(r.code).emit("kill",{killer:killerName,victim:victim.name});
  victim.hp=100;victim.x=(Math.random()-.5)*45;victim.z=(Math.random()-.5)*45;
}
function startVote(r){
  if(r.voting)return;r.voting=true;r.votes={};
  const shuffled=[...MAPS].sort(()=>Math.random()-.5).slice(0,3);
  r.voteOptions=shuffled;
  io.to(r.code).emit("voteStart",{options:shuffled,votes:r.votes});
  setTimeout(()=>finishVote(r),12000);
}
function finishVote(r){
  if(!r.voting)return;r.voting=false;
  const tally={};for(const m of r.voteOptions)tally[m.id]=0;
  for(const v of Object.values(r.votes))if(tally[v]!=null)tally[v]++;
  const winner=r.voteOptions.sort((a,b)=>tally[b.id]-tally[a.id])[0]||MAPS[0];
  r.map=winner.id;io.to(r.code).emit("roundStart",{map:r.map});
}
io.on("connection",s=>{
  s.on("listLobbies",()=>s.emit("lobbies",lobbyList()));
  s.on("create",({name})=>{const r=makeRoom(false);r.name=(name||"Host")+"'s Lobby";join(s,r.code,name||"Host")});
  s.on("quick",({name})=>{
    let candidates=[...rooms.values()].filter(r=>r.public&&r.players.size<r.max);
    let r=candidates[Math.floor(Math.random()*candidates.length)];if(!r)r=makeRoom(true);
    join(s,r.code,name||"Ranger");
  });
  s.on("join",({code,name})=>join(s,String(code||"").toUpperCase(),name||"Ranger"));
  s.on("move",d=>{
    const r=rooms.get(s.data.room),p=r?.players.get(s.id);if(!p||typeof d.x!=="number")return;
    p.x=Math.max(-70,Math.min(70,d.x));p.z=Math.max(-70,Math.min(70,d.z));p.rot=d.rot||0;
    if(p.vehicle){p.x=Math.max(-70,Math.min(70,p.x));p.z=Math.max(-70,Math.min(70,p.z))}
  });
  s.on("fire",b=>{
    const r=rooms.get(s.data.room),p=r?.players.get(s.id),w=WEAPONS[b.weapon];if(!r||!p||!w)return;
    const bullet={id:b.id||crypto.randomUUID(),owner:p.id,x:p.x,y:1.35,z:p.z,dx:Number(b.dx)||0,dz:Number(b.dz)||1,weapon:b.weapon,damage:w.damage,speed:w.speed,life:w.life,radius:w.radius||0,t:0};
    r.bullets.set(bullet.id,bullet);io.to(r.code).emit("fire",{...bullet,color:b.weapon===2?0xff6438:b.weapon===3?0x62e8ff:0xffd166});
  });
  s.on("vote",m=>{const r=rooms.get(s.data.room);if(r?.voting&&r.voteOptions.some(x=>x.id===m.map)){r.votes[s.id]=m.map;io.to(r.code).emit("voteUpdate",{options:r.voteOptions,votes:r.votes})}});
  s.on("vehicleToggle",()=>{
    const r=rooms.get(s.data.room),p=r?.players.get(s.id);if(!p)return;
    p.vehicle=!p.vehicle;
  });
  s.on("disconnect",()=>leave(s));
});
function join(s,code,name){
  const r=rooms.get(code);if(!r)return s.emit("errorMsg","Lobby not found.");
  if(r.players.size>=r.max)return s.emit("errorMsg","Lobby is full.");
  const p={id:s.id,name:String(name).slice(0,16),x:(Math.random()-.5)*45,y:0,z:(Math.random()-.5)*45,rot:0,hp:100,score:0,vehicle:false};
  r.players.set(s.id,p);s.data.room=code;s.join(code);
  s.emit("joined",{code,player:p,map:r.map});broadcast(r);io.emit("lobbies",lobbyList());
  if(r.players.size>=2&&!r.voting)startVote(r);
}
function leave(s){
  const c=s.data.room;if(!c)return;const r=rooms.get(c);if(!r)return;
  r.players.delete(s.id);s.leave(c);if(!r.players.size)rooms.delete(c);else broadcast(r);io.emit("lobbies",lobbyList());
}
setInterval(()=>{
  for(const r of rooms.values()){
    for(const [id,b] of r.bullets){
      b.x+=b.dx*b.speed*.05;b.z+=b.dz*b.speed*.05;b.t+=.05;
      let hit=null;
      for(const p of r.players.values()){if(p.id===b.owner)continue;if(Math.hypot(p.x-b.x,p.z-b.z)<1.3){hit=p;break}}
      if(hit){if(b.radius)explosion(r,b);else {hit.hp-=b.damage;io.to(r.code).emit("explosion",{x:b.x,y:1,z:b.z,radius:.5});if(hit.hp<=0)kill(r,hit,b.owner)}r.bullets.delete(id);continue}
      if(b.t>b.life||Math.abs(b.x)>75||Math.abs(b.z)>75){if(b.radius)explosion(r,b);r.bullets.delete(id)}
    }
    broadcast(r);
  }
},50);

server.listen(PORT,()=>console.log(`BOOMFRONT 3D running on port ${PORT}`));
