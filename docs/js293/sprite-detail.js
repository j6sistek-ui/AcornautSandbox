/** Publish a complete tier together so neighboring poses cannot mix resolutions. */
export function bindSpriteDetails(entries, load, now = () => performance.now()) {
    let pending;
    let retryAt = 0;
    const request = () => {
        if (pending)
            return pending;
        if (entries.every(({ sprite }) => !!sprite.detailImage) || now() < retryAt)
            return Promise.resolve();
        pending = Promise.all(entries.map(async ({ sprite, path }) => {
            const image = await load(path);
            if (image.width !== sprite.width * 2 || image.height !== sprite.height * 2)
                throw new Error("Invalid sprite detail dimensions");
            return image;
        })).then(images => {
            entries.forEach(({ sprite }, i) => { sprite.detailImage = images[i]; });
        }).catch(() => {
            // A missing optional tier leaves the original bank usable. Drawing must
            // not retry eighteen requests every frame during a network failure.
            retryAt = now() + 30000;
        }).finally(() => { pending = undefined; });
        return pending;
    };
    for (const { sprite } of entries)
        sprite.requestDetail = request;
}
/** Select source pixels only; callers retain the original logical destination. */
export function spriteImageFor(ctx, sprite, width, height) {
    if (!sprite.requestDetail && !sprite.detailImage)
        return sprite;
    const transform = ctx.getTransform?.();
    const sx = transform ? Math.hypot(transform.a, transform.b) : 1;
    const sy = transform ? Math.hypot(transform.c, transform.d) : 1;
    if (Math.max(Math.abs(width) * sx, Math.abs(height) * sy) <= 256)
        return sprite;
    if (sprite.detailImage)
        return sprite.detailImage;
    void sprite.requestDetail?.();
    return sprite;
}
