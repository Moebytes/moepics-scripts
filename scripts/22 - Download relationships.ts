import Moepictures from "moepics-api"
import fs from "fs"
import path from "path"

const downloadRelationships = async () => {
    const moepics = new Moepictures(process.env.MOEPICTURES_API_KEY!)

    let dest = `/Volumes/Files/Image Sorting/relationships`

    let postMap = {} as {[key: string]: boolean}

    const groups = await moepics.search.groups({query: "", limit: 99999})
    console.log(groups.length)

    for (const group of groups) {
        for (const post of group.posts) {
            if (!post.source) continue
            const pixivID = post.source.match(/\d+/)?.[0]
            let j = 0
            for (let i = 0; i < post.images.length; i++) {
                const thumb = moepics.links.getThumbnailLink(post.images[i], "medium")
                const buffer = await moepics.api.fetch(thumb).then((r) => r.arrayBuffer())
                let filename = ""
                do {
                    let qualifier = `${i === 0 ? "g" : "g!"}${j++}`
                    filename = `${pixivID}_${qualifier}.jpg`
                } while (fs.existsSync(path.join(dest, filename)))
                fs.writeFileSync(path.join(dest, filename), Buffer.from(buffer))
            }
            postMap[post.postID] = true
        }
    }

    const posts = await moepics.search.posts({query: "", type: "image", rating: "all", style: "all+s", showChildren: true, limit: 99999})

    const childPosts = posts.filter((p) => p.parentID)
    const variantPosts = posts.filter((p) => Number(p.variantCount) > 1)

    const downloadImages = async (images: any, pixivID: string, prefix: "g" | "c" | "p",
        counter: { value: number }, useVariation = false) => {
        for (let i = 0; i < images.length; i++) {
            let filename: string

            do {
                const j = counter.value++
                const qualifier =
                    prefix === "p"
                        ? `p${j}`
                        : `${prefix}${useVariation && i !== 0 ? "!" : ""}${j}`

                filename = `${pixivID}_${qualifier}.jpg`
            } while (fs.existsSync(path.join(dest, filename)))

            const thumb = moepics.links.getThumbnailLink(images[i], "medium")
            const response = await moepics.api.fetch(thumb)
            fs.writeFileSync(
                path.join(dest, filename),
                Buffer.from(await response.arrayBuffer())
            )
        }
    }

    const childrenByParent = new Map<string, typeof posts>()
    for (const post of posts) {
        if (!post.parentID) continue
        const children = childrenByParent.get(post.parentID) ?? []
        children.push(post)
        childrenByParent.set(post.parentID, children)
    }

    for (const [parentID, children] of childrenByParent) {
        if (postMap[parentID]) continue

        const unprocessedChildren = children.filter(child => !postMap[child.postID])
        if (unprocessedChildren.length === 0) continue

        const parent = await moepics.posts.get(parentID)
        if (!parent?.source) continue

        const pixivID = parent.source.match(/\d+/)?.[0]
        if (!pixivID) continue

        const counter = {value: 0}

        if (!postMap[parent.postID]) {
            await downloadImages(
                parent.images,
                pixivID,
                "c",
                counter, true
            )

            postMap[parent.postID] = true
        }

        const familyChildren = await moepics.posts.children(parentID)
        const downloadedChildren = new Set<string>()

        for (const entry of familyChildren) {
            const childPost = entry.post

            if (downloadedChildren.has(childPost.postID)) continue
            if (postMap[childPost.postID]) continue

            downloadedChildren.add(childPost.postID)

            await downloadImages(
                childPost.images,
                pixivID,
                "c",
                counter
            )

            postMap[childPost.postID] = true
        }
    }

    for (const post of variantPosts) {
        if (postMap[post.postID]) continue
        if (!post.source) continue
        const pixivID = post.source.match(/\d+/)?.[0]
        let j = 0
        for (let i = 0; i < post.images.length; i++) {
            const thumb = moepics.links.getThumbnailLink(post.images[i], "medium")
            const buffer = await moepics.api.fetch(thumb).then((r) => r.arrayBuffer())
            let filename = ""
            do {
                let qualifier = `p${j++}`
                filename = `${pixivID}_${qualifier}.jpg`
            } while (fs.existsSync(path.join(dest, filename)))
            fs.writeFileSync(path.join(dest, filename), Buffer.from(buffer))
        }
        postMap[post.postID] = true
    }
}

export default downloadRelationships