require("dotenv").config();
const express=require("express");
const multer=require("multer");
const cors=require("cors");
const fs=require("fs");
const path=require("path");
const {execFile}=require("child_process");
const util=require("util");
const execFileAsync=util.promisify(execFile);
const app=express();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:10*1024*1024}});
app.use(cors({origin:true}));
app.get("/health",(req,res)=>res.json({ok:true}));
function imageToBase64(file){return file.buffer.toString("base64");}

app.post("/api/ocr/google",upload.single("image"),async(req,res)=>{
 try{
  if(!req.file)return res.status(400).json({error:"image is required"});
  const key=process.env.GOOGLE_VISION_API_KEY;
  if(!key)return res.status(500).json({error:"GOOGLE_VISION_API_KEY is not configured"});
  const url=`https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(key)}`;
  const body={requests:[{image:{content:imageToBase64(req.file)},features:[{type:"DOCUMENT_TEXT_DETECTION"}],imageContext:{languageHints:["ja"]}}]};
  const r=await fetch(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});
  const data=await r.json();
  if(!r.ok)return res.status(r.status).json({error:data.error?.message||"Google Vision error"});
  const text=data.responses?.[0]?.fullTextAnnotation?.text||data.responses?.[0]?.textAnnotations?.[0]?.description||"";
  res.json({engine:"google-vision",text});
 }catch(e){res.status(500).json({error:e.message});}
});

app.post("/api/ocr/selfhost",upload.single("image"),async(req,res)=>{
 try{
  if(!req.file)return res.status(400).json({error:"image is required"});
  const base=process.env.PADDLE_OCR_URL||"http://127.0.0.1:8000/ocr";
  const fd=new FormData();
  fd.append("image",new Blob([req.file.buffer],{type:req.file.mimetype}),req.file.originalname||"image.jpg");
  const r=await fetch(base,{method:"POST",body:fd});
  const data=await r.json();
  if(!r.ok)return res.status(r.status).json({error:data.error||"selfhost OCR error"});
  res.json({engine:"selfhost-paddleocr",text:data.text||""});
 }catch(e){res.status(500).json({error:e.message});}
});
const port=Number(process.env.PORT||8787);
app.listen(port,()=>console.log(`OCR backend: http://localhost:${port}`));
