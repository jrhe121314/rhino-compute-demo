const compute = require('compute-rhino3d')
const rhino3dm = require("rhino3dm")

const THREE = require('three')
const Canvas = require('canvas')
const { Blob, FileReader } = require('vblob')
const XMLHttpRequest = require("xmlhttprequest").XMLHttpRequest

const solveGH = (input, definitionPath) => {
  return new Promise((resolve, reject) => {
    let computeServerTiming
    compute.url = process.env.RHINO_COMPUTE_URL
    compute.apiKey = process.env.RHINO_COMPUTE_KEY
    let trees = []
    for (let [key, value] of Object.entries(input)) {
      let param = new compute.Grasshopper.DataTree(key)
      param.append([0], Array.isArray(value) ? value : [value])
      trees.push(param)
    }
    // call compute server
    compute.Grasshopper.evaluateDefinition(definitionPath, trees, false)
      .then((response) => {
        if(!response.ok) {
          reject(new Error(response.statusText))
        } else {
          computeServerTiming = response.headers
          return response.text()
        }
      })
      .then((result) => {
        resolve({
          computeServerTiming,
          result
        })
      })
      .catch((error) => {
        reject(error)
      })
  })
}

const generateRhinoObj = (responseStr) => {
  const responseJson = JSON.parse(responseStr)
  const values = responseJson.values
  return new Promise((resolve, reject) => {
    rhino3dm().then((rhino) => {
      let rhinoMeshObjectArray = []
      // for each output (RH_OUT:*)...
      for ( let i = 0; i < values.length; i ++ ) {
        // ...iterate through data tree structure...
        for (const path in values[i].InnerTree) {
          const branch = values[i].InnerTree[path]
          // ...and for each branch...
          for( let j = 0; j < branch.length; j ++) {
            if (branch[j].type === 'Rhino.Geometry.Mesh') {
              let meshObj = _decodeItem(branch[j], rhino)
              meshObj.name = values[i].ParamName
              rhinoMeshObjectArray.push(meshObj)
            }
            // else if (branch[j].type === 'Rhino.Display.DisplayMaterial') {
            //   rhinoMaterialObject = _decodeItem(branch[j], rhino)
            // }
          }
        }
      }
      resolve({
        rhinoMeshObjectArray,
      })
    })
  })
}

const generateBuffer = (rhinoMeshArr, skuNumber, format) => {
  injectHack()

  // Three loader
  let loader = new THREE.BufferGeometryLoader()
  let resultArr = []
  for(let i = 0; i < rhinoMeshArr.length; i++){
    let rhinoMesh = rhinoMeshArr[i]
    let geometry = loader.parse(rhinoMesh.toThreejsJSON())
    let newMesh
    if (rhinoMesh.name == "RH_OUT:mesh") {
      // Material
      let threeMaterial = new THREE.MeshBasicMaterial()
      let diffuse
      switch (skuNumber){
        case "0":
          diffuse = `rgb(242, 212, 39)`
          break
        case "1":
          diffuse = `rgb(227, 188, 195)`
          break
        case "2":
          diffuse = `rgb(143, 148, 147)`
          break
        case "3":
          diffuse = `rgb(204, 204, 204)`
          break
        default:
          diffuse = `rgb(204, 204, 204)`
          break
      }
      const color = new THREE.Color(diffuse);
      threeMaterial.color = color
      // Mesh
      newMesh = new THREE.Mesh(geometry, threeMaterial)
      newMesh.name = "sku"
      newMesh.material.name = "sku"
    } else { // RH_OUT:mesh_gem
      newMesh = new THREE.Mesh(geometry)
      newMesh.name = "s1"
      newMesh.material.name = "s1"
    }
    resultArr.push(newMesh)
  }

  return new Promise((resolve, reject) => {
    if (format == 'stl') {
      require('three/examples/js/exporters/STLExporter')
      const exporter = new THREE.STLExporter()
      const result = exporter.parse(resultArr[0])
      const blob = new Blob( [result], { type : 'text/plain' } )
      const reader = new FileReader()
      reader.onload = function(){
        const buffer = Buffer.from(reader.result)
        resolve(buffer)
      }
      reader.onloadend = function(){
        releaseHack()
      }
      reader.onerror = function(error){
        releaseHack()
      }
      reader.readAsArrayBuffer(blob)
    } else {
      // glb by default
      require('three/examples/js/exporters/GLTFExporter')
      const exporter = new THREE.GLTFExporter()
      const options = {
        trs: false,
        onlyVisible: true,
        truncateDrawRange: true,
        binary: true,
        maxTextureSize: 4096 || Infinity // To prevent NaN value
      };
      exporter.parse(resultArr, (result) => {
        if ( result instanceof ArrayBuffer ) {
          const blob = new Blob( [ result ], { type: 'application/octet-stream' } )
          const reader = new FileReader()
          reader.onload = function(){
            const buffer = Buffer.from(reader.result)
            resolve(buffer)
          }
          reader.onloadend = function(){
            releaseHack()
          }
          reader.onerror = function(){
            releaseHack()
          }
          reader.readAsArrayBuffer(blob)
        }
      }, options)
    }

  })
}

// Hack in nodejs
const injectHack = () => {
  global.window = global
  global.Blob = Blob
  global.XMLHttpRequest = XMLHttpRequest
  global.FileReader = FileReader
  global.THREE = THREE
  global.document = {
    createElement: (nodeName) => {
      if (nodeName !== 'canvas') throw new Error(`Cannot create node ${nodeName}`)
      const canvas = new Canvas(256, 256)
      return canvas
    }
  }
}

const releaseHack = () => {
  global.window = undefined
  global.Blob = undefined
  global.XMLHttpRequest = undefined
  global.FileReader = undefined
  global.THREE = undefined
  global.document = undefined
}

module.exports = {
  solveGH,
  generateRhinoObj,
  generateBuffer,
}


const _decodeItem = (item, rhino) => {
  const data = JSON.parse(item.data)
  if (item.type === 'System.String') {
    // hack for draco meshes
    try {
        return rhino.DracoCompression.decompressBase64String(data)
    } catch {} // ignore errors (maybe the string was just a string...)
  } else if (typeof data === 'object') {
    return rhino.CommonObject.decode(data)
  }
  // else if (item.type === 'Rhino.Display.DisplayMaterial') {
  //   return data
  // }
  return null
}