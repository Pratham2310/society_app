const B="http://localhost:5000/api/v1";
let token=null;
const call=async(m,p,b,anon)=>{
  const r=await fetch(B+p,{method:m,headers:{"Content-Type":"application/json",Origin:"http://localhost:5173",
    ...(token&&!anon?{Authorization:"Bearer "+token}:{})},body:b?JSON.stringify(b):undefined});
  return {ok:r.ok,status:r.status,body:await r.json().catch(()=>({}))};
};
(async()=>{
  const r=await call("POST","/auth/login",{identifier:"sec.emeraldheigh@demo.example.com",password:"Password123!"},true);
  token=r.body?.data?.token;
  console.log("SECRETARY  sec.emeraldheigh@demo.example.com");
  console.log("  signed in:",r.body?.data?.user?.name,"|",r.body?.data?.user?.societyRole);
  const pend=await call("GET","/users/pending-users");
  console.log("  Approvals:");
  (pend.body?.data??[]).forEach(u=>console.log("     ",u.name.padEnd(16),"flat",String(u.flatNumber).padEnd(5),u.occupancyType,"·",u.livingType));
  const not=await call("GET","/notices?page=1&limit=10");
  console.log("  Notices:");
  (not.body?.data??[]).forEach(n=>console.log("     ",(n.isUrgent?"[URGENT] ":"         ")+n.title));
  const d=await call("GET","/residents/dashboard");
  console.log("  Dashboard urgent notice:",d.body?.data?.urgentNotice?.title??"none");
  console.log("  Dashboard announcements:",(d.body?.data?.announcements??[]).length);
})();
