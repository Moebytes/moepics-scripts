import Moepictures from "moepics-api"
import fs from "fs"
import path from "path"

const filterDuplicates = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const folderCheck = ""
    const dupeFolder = ""

    const files = fs.readdirSync(folderCheck)

    for (const file of files) {
        if (file === ".DS_Store" || file === "files.json") continue
        const filePath = path.join(folderCheck, file)
        const dupePath = path.join(dupeFolder, file)
        const buffer = fs.readFileSync(filePath).buffer
        const bytes = new Uint8Array(buffer)

        const result = await moepics.search.similar({bytes: Object.values(bytes), useMD5: false})
        if (result.length) {
            console.log(`dupe: ${file}`)
            fs.renameSync(filePath, dupePath)
        }
    }
}

export default filterDuplicates