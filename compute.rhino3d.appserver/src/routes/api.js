const express = require('express')
const path = require("path");
const multer  = require('multer')
const storage = multer.diskStorage({
  destination: './src/dxf/',
  filename: function ( req, file, cb ) {
    cb( null, file.originalname)
  }
});
const upload = multer( { storage: storage } );
const router = express.Router()

// Libs
const {performance} = require('perf_hooks')
const memjs = require('memjs')

// Services
const { getCache, setCache } = require('../services/cache')
const { solveGH, generateRhinoObj, generateBuffer } = require('../services/rhino')
const { saveOutputFile } = require('../services/fileStorage')

// In case you have a local memached server
// process.env.MEMCACHIER_SERVERS = '127.0.0.1:11211'
let mc = null
if(process.env.MEMCACHIER_SERVERS !== undefined) {
  mc = memjs.Client.create(process.env.MEMCACHIER_SERVERS, {
    failover: true,  // default: false
    timeout: 1,      // default: 0.5 (seconds)
    keepAlive: true  // default: false
  })
}

router.post('/glb', upload.single('File'), async (req, res) => {

  if (req.file == undefined) {
    return res.status(403).json({
      msg: "File is required"
    })
  } else if (req.file.mimetype !=  "image/vnd.dxf") {
    return res.status(403).json({
      msg: "File must be .dxf"
    })
  } else if (["0", "1", "2", "3"].indexOf(req.body["RH_IN:number"]) == -1){
    return res.status(403).json({
      msg: "RH_IN:number mnust be one of [0,1,2,3]"
    })
  } else if (["stl", "glb"].indexOf(req.body["Format"]) == -1){
    return res.status(403).json({
      msg: "Format mnust be one of [stl,glb]"
    })
  }

  const timePostStart = performance.now()
  res.setHeader('Cache-Control', 'public, max-age=31536000')
  res.setHeader('Content-Type', 'application/json')

  try{
    // 1. check unique cache
    // const ghScript = "diamond_sku.gh"
    // const ghScript = "nameplate_definition_v2_signpainter.gh"
    const ghScript = "nameplate_definition_v2.gh"
    req.body["RH_IN:path"] = path.resolve(req.file.path)
    let definition = req.app.get('definitions').find(o => o.name === ghScript)
    const key = {}
    key.definition = { 'name': definition.name, 'id': definition.id }
    key.inputs = req.body
    const cacheKey = JSON.stringify(key)
    res.locals.cacheKey = cacheKey
    res.locals.cacheResult = getCache(mc, cacheKey)

    const skuNumber = req.body["RH_IN:number"]
    const format = req.body.Format
    if(res.locals.cacheResult !== null) {
      const timespanPost = Math.round(performance.now() - timePostStart)
      res.setHeader('Server-Timing', `cacheHit;dur=${timespanPost}`)

      const {
        rhinoMeshObjectArray,
      } = await generateRhinoObj(res.locals.cacheResult)
      const buffer = await generateBuffer(rhinoMeshObjectArray, skuNumber, format)
      let fileName = req.file.filename.replace("dxf", format)
      await saveOutputFile(buffer, format, fileName)
      return res.json({
        file: fileName
      })
    } else {
      let fullUrl = req.protocol + '://' + req.get('host')
      let definitionPath = `${fullUrl}/definition/${definition.id}`
      const timePreComputeServerCall = performance.now()
      const {
        computeServerTiming,
        result,
      } = await solveGH(req.body, definitionPath)

      // dummy
      const timeComputeServerCallComplete = performance.now()
      let computeTimings = computeServerTiming.get('server-timing')
      let sum = 0
      computeTimings.split(',').forEach(element => {
        let t = element.split('=')[1].trim()
        sum += Number(t)
      })
      const timespanCompute = timeComputeServerCallComplete - timePreComputeServerCall
      const timespanComputeNetwork = Math.round(timespanCompute - sum)
      const timespanSetup = Math.round(timePreComputeServerCall - timePostStart)
      const timing = `setup;dur=${timespanSetup}, ${computeTimings}, network;dur=${timespanComputeNetwork}`
      res.setHeader('Server-Timing', timing)
      setCache(mc, cacheKey, result)
      // dummy

      const {
        rhinoMeshObjectArray
      } = await generateRhinoObj(result)
      const buffer = await generateBuffer(rhinoMeshObjectArray, skuNumber, format)
      let fileName = req.file.filename.replace("dxf", format)
      await saveOutputFile(buffer, format, fileName)
      return res.json({
        file: fileName
      })
    }
  } catch (error) {
    return res.json({
      error
    })
  }
})

module.exports = router