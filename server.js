import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const app=express();app.disable('x-powered-by');app.use(helmet({contentSecurityPolicy:false}));
const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const upload=multer({storage:multer.memoryStorage(),limits:{files:4,fileSize:10*1024*1024,fields:3},fileFilter(req,file,cb){const types=['image/jpeg','image/png','image/webp','application/pdf'];cb(null,types.includes(file.mimetype));}});
const limiter=rateLimit({windowMs:15*60*1000,limit:8,standardHeaders:'draft-7',legacyHeaders:false});
const allowedKeys=new Set(['type','installer','service','postcode','site','usage','size','timeline','development','plots','scope','property','bill','manufacturer','issue','model','faultcode','details','name','email','phone','company','address','postcode2','consent']);
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clean=s=>String(s??'').trim().slice(0,3000);
app.post('/api/enquiry',limiter,upload.array('attachments',4),async(req,res)=>{
 try{
  const mode=req.body.mode;if(!['sales','support'].includes(mode))return res.status(400).json({error:'Invalid enquiry type.'});
  let raw;try{raw=JSON.parse(req.body.details||'{}')}catch{return res.status(400).json({error:'Invalid form details.'})}
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return res.status(400).json({error:'Invalid form details.'});
  const data=Object.fromEntries(Object.entries(raw).filter(([k])=>allowedKeys.has(k)).map(([k,v])=>[k,typeof v==='boolean'?v:clean(v)]));
  if(!data.consent||!data.name||!data.address||!data.postcode2||!data.phone||!/^\S+@\S+\.\S+$/.test(data.email||''))return res.status(400).json({error:'Please complete all required contact fields.'});
  if(mode==='sales'&&!['Residential','Commercial','Developer'].includes(data.type))return res.status(400).json({error:'Please select a project type.'});
  if(mode==='support'&&(!data.installer||!data.manufacturer||!data.issue||!data.details))return res.status(400).json({error:'Please complete the fault information.'});
  const files=req.files||[];if(files.some(f=>!['image/jpeg','image/png','image/webp','application/pdf'].includes(f.mimetype)))return res.status(400).json({error:'Unsupported attachment type.'});
  const env=['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','MAIL_FROM'];if(env.some(k=>!process.env[k]))return res.status(503).json({error:'Email delivery has not been configured yet. Please contact us by email or WhatsApp.'});
  const reference='HE-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();
  const subject=`[HOLICON ${mode==='sales'?'NEW '+data.type.toUpperCase():'MAINTENANCE'}] ${clean(data.postcode2)} — ${reference}`.replace(/[\r\n]/g,' ');
  const body=Object.entries(data).filter(([k])=>k!=='consent').map(([k,v])=>`${k}: ${v}`).join('\n');
  const transport=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT),secure:process.env.SMTP_SECURE==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
  await transport.sendMail({from:process.env.MAIL_FROM,to:process.env.MAIL_TO||'admin@holiconenergy.co.uk',replyTo:data.email,subject,text:`Enquiry reference: ${reference}\nType: ${mode}\n\n${body}\n\nAttachments: ${files.length}`,attachments:files.map((f,i)=>({filename:`attachment-${i+1}${path.extname(f.originalname).slice(0,8)}`,content:f.buffer,contentType:f.mimetype}))});
  res.json({reference});
 }catch(e){console.error('Enquiry delivery error:',e.message);res.status(500).json({error:'Unable to deliver the enquiry right now. Please email admin@holiconenergy.co.uk or use WhatsApp.'})}
});
app.use(express.static(site,{index:'index.html'}));app.listen(Number(process.env.PORT)||3000,()=>console.log('Holicon site listening'));
