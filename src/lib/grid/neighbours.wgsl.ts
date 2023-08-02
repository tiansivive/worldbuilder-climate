export const neighbours = `
fn neighbourIndices(p: vec2u) -> vec4u {
    var left: u32;
    if (p.x == 0) {
        left = index(vec2(params.size.x - 1, p.y));
    } else {
        left = index(vec2(p.x - 1, p.y));
    }
    var right: u32;
    if (p.x == params.size.x - 1) {
        right = index(vec2(0, p.y));
    } else {
        right = index(vec2(p.x + 1, p.y));
    }
    var up: u32;
    if (p.y == 0) {
        up = index(vec2(p.x, p.y));
    } else {
        up = index(vec2(p.x, p.y - 1));
    }
    var down: u32;
    if (p.y == params.size.y - 1) {
        left = index(vec2(p.x, p.y));
    } else {
        left = index(vec2(p.x, p.y + 1));
    }

    return vec4(left, right, up, down);
}
`