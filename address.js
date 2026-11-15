export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 const q=String(req.query.q||'').trim().slice(0,120);
 if(q.length<4)return res.status(200).json({suggestions:[]});
 const key=process.env.IDEAL_POSTCODES_API_KEY;
 if(!key)return res.status(200).json({suggestions:[],configured:false});
 try{
  const url='https://api.ideal-postcodes.co.uk/v1/autocomplete/addresses?api_key='+encodeURIComponent(key)+'&query='+encodeURIComponent(q);
  const r=await fetch(url);if(!r.ok)throw Error('Lookup unavailable');
  const json=await r.json();
  const suggestions=(json.result?.hits||[]).slice(0,8).map(x=>({address:String(x.suggestion||'').slice(0,250)}));
  res.setHeader('Cache-Control','private, max-age=30');return res.status(200).json({suggestions});
 }catch(e){return res.status(502).json({error:'Address lookup temporarily unavailable',suggestions:[]})}
}
