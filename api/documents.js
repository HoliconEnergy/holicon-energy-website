import nodemailer from 'nodemailer';
import crypto from 'node:crypto';

const allowedDocuments=new Set(['MCS certificate','Electrical installation certificate','DNO notification / approval','Warranty documents','Commissioning / handover pack','Other installation paperwork']);
function clean(value,max=500){return String(value??'').trim().replace(/[\r\n\t]+/g,' ').slice(0,max);}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({error:'Method not allowed.'});}
  if(Number(req.headers['content-length']||0)>10000)return res.status(413).json({error:'Request too large.'});
  const d=req.body||{};
  if(typeof d!=='object'||Array.isArray(d))return res.status(400).json({error:'Invalid request.'});
  if(d.website||d.companyWebsite)return res.status(200).json({reference:'REQUEST-RECEIVED'});
  const name=clean(d.name,120),email=clean(d.email,200),phone=clean(d.phone,50),address=clean(d.address,600),postcode=clean(d.postcode,20),details=clean(d.details,1500);
  const docs=Array.isArray(d.documents)?d.documents.filter(x=>allowedDocuments.has(x)):[], unique=[...new Set(docs)];
  if(!name||!email||!phone||!address||!postcode||!unique.length||d.consent!==true||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return res.status(400).json({error:'Please provide your contact details, installation address and at least one document.'});
  const env=['SMTP_HOST','SMTP_PORT','SMTP_USER','SMTP_PASS','MAIL_FROM'];
  if(env.some(k=>!process.env[k]))return res.status(503).json({error:'Email requests are temporarily unavailable. Please contact admin@holiconenergy.co.uk.'});
  const ref='HD-'+new Date().toISOString().slice(0,10).replaceAll('-','')+'-'+crypto.randomBytes(3).toString('hex').toUpperCase();
  try{
    const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT),secure:process.env.SMTP_SECURE==='true',auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});
    await transporter.sendMail({from:process.env.MAIL_FROM,to:process.env.MAIL_TO||'admin@holiconenergy.co.uk',replyTo:email,subject:'[DOCUMENT REQUEST - VERIFY OWNERSHIP] '+postcode+' - '+ref,text:[
      'Holicon Energy customer document request', 'Reference: '+ref, '',
      'PLEASE VERIFY REQUESTER IS AUTHORISED BEFORE SHARING ANY INSTALLATION DOCUMENTS.', '',
      'Name: '+name,'Email: '+email,'Phone: '+phone,'Installation address: '+address,'Postcode: '+postcode,'Requested: '+unique.join(', '),'Additional details: '+details,
      'Consent: customer agreed to use of details solely to handle this request'
    ].join('\n')});
    return res.status(200).json({reference:ref});
  }catch(err){console.error('Document-request email send failed');return res.status(502).json({error:'We could not deliver your request. Please email admin@holiconenergy.co.uk.'});}
}