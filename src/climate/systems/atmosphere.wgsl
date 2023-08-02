
@binding(0) @group(0) 
var<uniform> frame : u32;


@vertex
fn vtx_main(@builtin(vertex_index) vertex_index: u32) -> @builtin(position) vec4 {


    const pos = array(
        vec2(0.0, 0.5),
        vec2(-0.5, -0.5),
        vec2(0.5, -0.5)
    );

   // return vec4(pos[vertex_index], 0, 1);
    return
}

@fragment
fn frag_main() -> @location(0) vec4f {

    //return vec4(0, sin(f32(frame) / 128), 1, 0);
}
