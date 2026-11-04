import Moepictures from "moepics-api"
import dist from "sharp-phash/distance"
import functions from "../functions/Functions"
import fs from "fs"

const removeDefaultPfp = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    const tags = await moepics.search.tags({type: "artist", sort: "reverse date", limit: 999999})
    console.log(tags.length)

    const baseBuffer = fs.readFileSync("./images/defaultpixiv.png")
    const baseHash = await functions.pHash(baseBuffer)

    let i = 0
    let skip = 15172
    for (const tag of tags) {
        i++
        if (i < skip) continue
        if (tag.image) {
            console.log(i)
            const tagLink = moepics.links.getTagLink(tag.type, tag.image)
            let buffer = await moepics.api.fetch(tagLink).then((r) => r.arrayBuffer())
            if (!buffer.byteLength) {
                console.log(tagLink)
                await functions.timeout(5000)
                buffer = await moepics.api.fetch(tagLink).then((r) => r.arrayBuffer())
            }
            const hash = await functions.pHash(Buffer.from(buffer))
            if (dist(hash, baseHash) < 6) {
                await moepics.tags.edit({tag: tag.tag, image: ["delete"], silent: true})
                console.log(`${i}: ${tag.tag}`)
            }
        }
    }
}

export default removeDefaultPfp