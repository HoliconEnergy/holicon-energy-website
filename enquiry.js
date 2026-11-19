import formidable from 'formidable';
import nodemailer from 'nodemailer';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
export const config={api:{bodyParser:false}};
const allowed=new Set(['type','installer','service','postcode','site','usage','size','timeline','development','plots','scope','property','bill','manufacturer','issue','model','faultcode','details','name','email','phone','company','address','postcode2','consent','charges']);
const clean=x=>String(x??'').trim().slice(0,3000);
export default async function handler(req,res){
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'});}
 if(Number(req.headers['content-length']||0)>18*1024*1024)return res.status(413).json({error:'Attachments exceed the request limit.'});
 let uploaded=[];
 try{
  const form=formidable({multiples:true,maxFiles:4,maxFileSize:4*1024*1024,maxTotalFileSize:16*1024*1024,maxFields:4,allowEmptyFiles:false});
  const [fields,files]=await form.parse(req);uploaded=files.attachments||[];
  const mode=fields.mode?.[0];if(!['sales','support','customer-care','third-party'].includes(mode))return res.status(400).json({error:'Invalid enquiry type.'});
  let raw;try{raw=JSON.parse(fields.details?.[0]||'{}')}catch{return res.status(400).json({error:'Invalid form details.'})}
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return res.status(400).json({error:'Invalid form details.'});
  const data=Object.fromEntries(Object.entries(raw).filter(([k])=>allowed.has(k)).map(([k,v])=>[k,typeof v==='boolean'?v:clean(v)]));
  if(!data.consent||!data.name||!data.address||!data.postcode2||!data.phone||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email||''))return res.status(400).json({error:'Please complete all required contact fields.'});
  if(mode==='sales'&&!['Residential','Commercial','Developer'].includes(data.type))return res.status(400).json({error:'Please select a project type.'});
  if(mode==='support'&&(!data.installer||!data.manufacturer||!data.issue||!data.details))return res.status(400).json({error:'Please complete the fault information.'});
  if(['customer-care','third-party'].includes(mode)&&(!data.charges||!data.manufacturer||!data.issue||!data.details))return res.status(400).json({error:'Please complete the support details and acknowledgement.'});
  const acceptable=['image/jpeg','image/png','image/webp','application/pdf'];
  for(const f of uploaded){if(!acceptable.includes(f.mimetype))return res.status(400).json({error:'Unsupported attachment type.'});const head=await fs.readFile(f.filepath);const ok=f.mimetype==='application/pdf'?head.subarray(0,5).toString()==='%PDF-':f.mimetype==='image/png'?head.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):f.mimetype==='image/jpeg'?head[0]===255&&head[1]===216&&head[2]===255:head.subarray(0,4).toString()==='RIFF'&&head.subarray(8,12).toString()==='WEBP';if(!ok)return res.status(400).json({error:'One attachment is not a valid image or PDF.'});}
  const required=['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','MAIL_FROM'];if(required.some(k=>!process.env[k]))return res.status(503).json({error:'Email delivery is not configured yet. Please contact admin@holiconenergy.co.uk.'});
  const ref='HE-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();
  const category=mode==='customer-care'?'HOLICON CUSTOMER CARE - PRIORITY':mode==='third-party'?'THIRD-PARTY SERVICE':mode==='support'?'MAINTENANCE':'NEW '+data.type.toUpperCase();
  const subject=`[${category}] ${clean(data.postcode2)} - ${ref}`.replace(/[\r\n]/g,' ');
  const attachments=await Promise.all(uploaded.map(async(f,i)=>({filename:'attachment-'+(i+1)+path.extname(f.originalFilename||'').slice(0,8),content:await fs.readFile(f.filepath),contentType:f.mimetype})));
  const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT),secure:process.env.SMTP_SECURE==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
  await transporter.sendMail({from:process.env.MAIL_FROM,to:process.env.MAIL_TO||'admin@holiconenergy.co.uk',replyTo:data.email,subject,text:`Reference: ${ref}\nCategory: ${category}\n\n`+Object.entries(data).filter(([k])=>!['consent','charges'].includes(k)).map(([k,v])=>`${k}: ${v}`).join('\n')+`\n\nPotential charges acknowledged: ${!!data.charges}`,attachments});
  return res.status(200).json({reference:ref});
 }catch(e){console.error('Enquiry error:',e.message);return res.status(500).json({error:'We could not deliver your enquiry. Please email admin@holiconenergy.co.uk.'});}
 finally{await Promise.all(uploaded.map(f=>fs.unlink(f.filepath).catch(()=>{})));}
}
