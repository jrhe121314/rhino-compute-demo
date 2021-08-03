const fs = require('fs')
const path = require('path')

const saveOutputFile = (buffer, folderName, fileName) => {
  return new Promise((resolve, reject) => {
    const pathName = path.join(__dirname, `../${folderName}/`, fileName)
    fs.writeFile(pathName, buffer, {}, (err, res) => {
      if(err){
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

module.exports = {
  saveOutputFile
}