/* tslint:disable */
/* eslint-disable */

/**
 * Ready-to-use browser entry points. Rust applications can also use the
 * individual adapters without this wasm-bindgen facade.
 */
export class BrowserCore {
    free(): void;
    [Symbol.dispose](): void;
    addTrustedServer(host: string, port: number): void;
    creditElement(html: string, show_on_screen: boolean): any;
    fetchImage(url: string, flip_y: boolean, skip_color_space_conversion: boolean): Promise<any>;
    fetchJson(url: string): Promise<any>;
    constructor();
    rgbaCanvas(bytes: Uint8Array, width: number, height: number): any;
    transcodeKtx2(bytes: Uint8Array, formats: any): Promise<any>;
}

export class BrowserPinBuilder {
    free(): void;
    [Symbol.dispose](): void;
    fromColor(c: any, size: number): any;
    fromMakiIconId(id: string, c: any, size: number, base_url: string): Promise<any>;
    fromText(text: string, c: any, size: number): any;
    fromUrl(url: string, c: any, size: number): Promise<any>;
    constructor();
}

export class BrowserScene {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Adds a JS-callback-backed imagery layer (powers `imageHooks`, `vectorBase`,
     * `imageryFrames`, `imageryDecoded`, and custom tile hooks).
     */
    add_js_imagery(callback: Function, geographic: boolean, single_tile: boolean, west_deg: number, south_deg: number, east_deg: number, north_deg: number, min_level: number, max_level: number, tile_size: number, alpha: number, show: boolean, split_dir: number, min_terrain_level: number, credit_text: string, index: number, on_tileset: boolean): number;
    add_post_process_stage(name: string, fragment_shader: string, uniforms_json: string, enabled: boolean): void;
    /**
     * Adds a single-image imagery layer over a geodetic rectangle.
     */
    add_single_image_imagery(url: string, west_deg: number, south_deg: number, east_deg: number, north_deg: number, tile_width: number, tile_height: number, alpha: number, show: boolean, credit_text: string, index: number): number;
    /**
     * Adds a Web Mercator or Geographic XYZ URL template imagery layer.
     */
    add_xyz_imagery(url: string, subdomains_json: string, geographic: boolean, west_deg: number, south_deg: number, east_deg: number, north_deg: number, min_level: number, max_level: number, tile_size: number, alpha: number, show: boolean, credit_text: string, index: number): number;
    /**
     * Applies an async-loaded terrain provider synchronously to the globe.
     */
    apply_loaded_terrain(terrain: LoadedTerrain, exaggeration: number): void;
    attach_model(set_id: string, item_id: string, loaded: LoadedModel, options_json: string): void;
    camera_input_event(kind: string, modifier: string, x: number, y: number, end_x: number, end_y: number, wheel_delta: number, time_ms: number): void;
    clear_icon_set(set_id: string): void;
    clear_imagery(): void;
    clear_models(set_id: string): void;
    create_icon_set(id: string, show: boolean, pickable: boolean, draw_order: number): void;
    create_line_set(id: string, show: boolean, pickable: boolean, draw_order: number): void;
    create_model_set(id: string, show: boolean, pickable: boolean, draw_order: number): void;
    create_point_set(id: string, show: boolean, pickable: boolean, draw_order: number): void;
    create_raster_shell(id: string, west_deg: number, south_deg: number, east_deg: number, north_deg: number, height_m: number, image_tex_id: string, detail_tex_id: string, window: Float64Array, alpha: number, lift_m: number, show: boolean): void;
    create_shape_set(id: string, show: boolean, pickable: boolean, draw_order: number): void;
    destroy(): void;
    dispose_draw_set(set_id: string): void;
    /**
     * GPU multi-hit drill pick at CSS pixel `(x, y)` returning `"{set_id}\0{item_id}"` entries.
     */
    drill_pick(x: number, y: number, width: number, height: number, limit: number): string[];
    force_render(epoch_ms: number): boolean;
    get_split_position(): number;
    globe_pending_tiles(): number;
    globe_visible(): boolean;
    has_shown_tileset(): boolean;
    icons_ready(): boolean;
    initialize_frame(monotonic_seconds: number): void;
    is_destroyed(): boolean;
    is_ellipsoid_terrain(): boolean;
    /**
     * Returns true if every currently rendered globe tile intersecting this layer's
     * rectangle has drawn this layer from its own imagery (or settled on failure).
     */
    is_imagery_layer_drawn(id: number): boolean;
    /**
     * Whether an ECEF point is occluded behind the WGS84 ellipsoid horizon from the current eye.
     */
    is_occluded(x: number, y: number, z: number): boolean;
    /**
     * Asynchronously loads a Cesium ion terrain asset (e.g. World Terrain asset 1).
     */
    load_ion_terrain(asset_id: bigint, access_token: string, request_vertex_normals: boolean): Promise<any>;
    /**
     * Asynchronously loads a 3D Tileset from Cesium ion (e.g. Google Photorealistic 3D Tiles asset 2275207).
     */
    load_ion_tileset(asset_id: bigint, access_token: string): Promise<any>;
    load_model_bytes(url: string, bytes: Uint8Array): Promise<any>;
    load_model_url(url: string): Promise<any>;
    /**
     * Asynchronously loads a quantized-mesh/heightmap terrain provider from a URL.
     */
    load_terrain_url(url: string, request_vertex_normals: boolean): Promise<any>;
    /**
     * Asynchronously loads a 3D Tileset from a URL (with optional Authorization header).
     */
    load_tileset_url(url: string, auth_header: string | null | undefined, credit_text: string): Promise<any>;
    lower_imagery(id: number): void;
    /**
     * Returns `[ready (0/1), bounding_radius, computed_scale]` for a model item, or empty if absent.
     */
    model_info(set_id: string, item_id: string): Float64Array;
    models_ready(): boolean;
    /**
     * Moves an imagery layer between the globe and the photoreal 3D tileset (or reorders it at `index`).
     */
    move_imagery_layer(id: number, to_tileset: boolean, index: number): void;
    /**
     * Creates a new WebGL2 `Scene` + `Globe` over an existing WebGL2 context.
     */
    constructor(gl: any, width: number, height: number, pixel_ratio: number, epoch_ms: number);
    patch_icons(set_id: string, patches_json: string): void;
    patch_points(set_id: string, patches_json: string): void;
    photoreal_tiles_loaded(): boolean;
    /**
     * GPU color pick at CSS pixel `(x, y)` with optional window `(w, h)`.
     * Returns `"{set_id}\0{item_id}"` or `None`, skipping unpickable (`\x01`-prefixed) items.
     */
    pick(x: number, y: number, width: number, height: number): string | undefined;
    /**
     * Ray-ellipsoid intersection for CSS pixel `(x, y)`. Returns `[x, y, z]` or empty.
     */
    pick_ellipsoid(x: number, y: number): Float64Array;
    /**
     * Ray intersection against the globe surface (terrain tiles when loaded, else ellipsoid).
     */
    pick_globe_ray(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): Float64Array;
    /**
     * Depth-buffer pick at CSS pixel `(x, y)`. Returns `[x, y, z]` ECEF or empty.
     */
    pick_position(x: number, y: number): Float64Array;
    pick_position_supported(): boolean;
    raise_imagery(id: number): void;
    /**
     * Casts a ray against `'surface' | 'terrain' | 'tiles'` (excluding non-ground draw sets).
     * Returns `[x, y, z]` ECEF or empty Vec.
     */
    ray_cast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, against: string, exclude_json: string, max_distance: number): Float64Array;
    /**
     * Reads RGBA8 pixels from the default framebuffer (top-left origin flipped to standard ImageData order).
     */
    read_pixels(x: number, y: number, width: number, height: number): Uint8Array;
    remove_icon(set_id: string, item_id: string): void;
    remove_imagery(id: number): void;
    remove_model(set_id: string, item_id: string): void;
    remove_post_process_stage(name: string): void;
    remove_raster_shell(id: string): void;
    remove_texture(tex_id: string): void;
    render(epoch_ms: number): boolean;
    render_requested(): boolean;
    rendered_globe_tiles(): number;
    replace_lines(set_id: string, items_json: string): void;
    replace_points(set_id: string, items_json: string): void;
    replace_shapes(set_id: string, items_json: string): void;
    request_render(): void;
    resize(width: number, height: number, pixel_ratio: number): void;
    /**
     * Synchronous height query at `(lon_rad, lat_rad)` against `'surface' | 'terrain' | 'tiles'`.
     * Returns `[height_m, source_code]` where `source_code`: 0=ellipsoid, 1=terrain, 2=tiles, 3=set;
     * or empty Vec on miss. Draw sets without `include_in_height_queries` are ignored.
     */
    sample_height_now(lon_rad: number, lat_rad: number, against: string, exclude_json: string): Float64Array;
    sample_height_supported(): boolean;
    /**
     * Samples the finest available terrain heights for packed `[lon_rad, lat_rad, ...]` coordinates.
     * Resolves to a `Float64Array`-compatible JS array of heights (NaN for misses).
     */
    sample_terrain_finest(lon_lat_rad: Float64Array): Promise<any>;
    set_bloom(enabled: boolean, contrast: number, brightness: number, delta: number, sigma: number, step_size: number): void;
    set_camera_controller_options(json: string): void;
    /**
     * Synchronizes the Rust `Scene`'s camera from an exact ECEF eye pose and vertical FOV.
     */
    set_camera_pose(px: number, py: number, pz: number, dx: number, dy: number, dz: number, ux: number, uy: number, uz: number, rx: number, ry: number, rz: number, fovy: number, near: number, far: number): void;
    set_draw_set_blend(set_id: string, blend: string): void;
    set_draw_set_height_query(set_id: string, include: boolean): void;
    set_draw_set_order(set_id: string, draw_order: number): void;
    set_draw_set_pickable(set_id: string, pickable: boolean): void;
    set_draw_set_show(set_id: string, show: boolean): void;
    set_globe_visible(visible: boolean): void;
    set_imagery_alpha(id: number, alpha: number): void;
    set_imagery_show(id: number, show: boolean): void;
    set_imagery_split_direction(id: number, dir: number): void;
    set_model_node_matrix(set_id: string, item_id: string, node_name: string, matrix: Float64Array): void;
    set_model_parts(set_id: string, item_id: string, shading: string, mask_rgb: Float64Array, rows: number, floats: Float32Array): void;
    set_photoreal_show(show: boolean): void;
    set_photoreal_tileset(tileset?: LoadedTileset | null): void;
    set_post_process_stage_enabled(name: string, enabled: boolean): void;
    set_post_process_stage_uniforms(name: string, uniforms_json: string): void;
    set_sky(atmosphere: boolean, fog: boolean, lighting: boolean): void;
    set_split_position(pos: number): void;
    set_surface_shading(enabled: boolean, strength: number): void;
    set_terrain_ellipsoid(exaggeration: number): void;
    set_vertical_exaggeration(exaggeration: number): void;
    step_camera_controller(time_ms: number, px: number, py: number, pz: number, dx: number, dy: number, dz: number, ux: number, uy: number, uz: number, rx: number, ry: number, rz: number, fovy: number, near: number, far: number, frame_matrix: Float64Array): Float64Array;
    tiles_loaded(): boolean;
    update_model(set_id: string, item_id: string, options_json: string): void;
    update_raster_shell(id: string, image_tex_id: string, detail_tex_id: string, window: Float64Array, alpha: number, lift_m: number, show: boolean): void;
    upload_texture_rgba(tex_id: string, width: number, height: number, rgba: Uint8Array): void;
    /**
     * Upserts one billboard icon using RGBA8 pixels decoded on the JS side.
     * When `image_id` is set and already uploaded to this icon set, `rgba` may be empty.
     */
    upsert_icon_rgba(set_id: string, options_json: string, img_width: number, img_height: number, rgba: Uint8Array): void;
    /**
     * Batch-upserts icons whose `image_id` has already been uploaded into this icon set's atlas.
     */
    upsert_icons_cached(set_id: string, items_json: string): void;
}

export class BrowserScreenSpaceEventHandler {
    free(): void;
    [Symbol.dispose](): void;
    destroy(): void;
    getInputAction(kind: number, modifier?: number | null): any;
    isDestroyed(): boolean;
    constructor(element: any);
    removeInputAction(kind: number, modifier?: number | null): void;
    setInputAction(action: Function, kind: number, modifier?: number | null): void;
}

/**
 * Async-loaded glTF/GLB model handle applied synchronously via `BrowserScene::attach_model`.
 */
export class LoadedModel {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
}

/**
 * Async-loaded terrain handle applied synchronously via `BrowserScene::apply_loaded_terrain`.
 */
export class LoadedTerrain {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    has_vertex_normals(): boolean;
}

/**
 * Async-loaded 3D Tileset handle applied synchronously via `BrowserScene::set_photoreal_tileset`.
 */
export class LoadedTileset {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
}

export function writeTextToCanvas(text: string, o: any): any;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_browsercore_free: (a: number, b: number) => void;
    readonly __wbg_browserpinbuilder_free: (a: number, b: number) => void;
    readonly __wbg_browserscene_free: (a: number, b: number) => void;
    readonly __wbg_browserscreenspaceeventhandler_free: (a: number, b: number) => void;
    readonly __wbg_loadedmodel_free: (a: number, b: number) => void;
    readonly __wbg_loadedterrain_free: (a: number, b: number) => void;
    readonly __wbg_loadedtileset_free: (a: number, b: number) => void;
    readonly browsercore_addTrustedServer: (a: number, b: number, c: number, d: number) => void;
    readonly browsercore_creditElement: (a: number, b: number, c: number, d: number) => number;
    readonly browsercore_fetchImage: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly browsercore_fetchJson: (a: number, b: number, c: number) => number;
    readonly browsercore_new: () => number;
    readonly browsercore_rgbaCanvas: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly browsercore_transcodeKtx2: (a: number, b: number, c: number, d: number) => number;
    readonly browserpinbuilder_fromColor: (a: number, b: number, c: number, d: number) => void;
    readonly browserpinbuilder_fromMakiIconId: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly browserpinbuilder_fromText: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly browserpinbuilder_fromUrl: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly browserpinbuilder_new: () => number;
    readonly browserscene_add_js_imagery: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number) => void;
    readonly browserscene_add_post_process_stage: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly browserscene_add_single_image_imagery: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number) => void;
    readonly browserscene_add_xyz_imagery: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number) => void;
    readonly browserscene_apply_loaded_terrain: (a: number, b: number, c: number) => void;
    readonly browserscene_attach_model: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly browserscene_camera_input_event: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number) => void;
    readonly browserscene_clear_icon_set: (a: number, b: number, c: number) => void;
    readonly browserscene_clear_imagery: (a: number) => void;
    readonly browserscene_clear_models: (a: number, b: number, c: number) => void;
    readonly browserscene_create_icon_set: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly browserscene_create_line_set: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly browserscene_create_model_set: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly browserscene_create_point_set: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly browserscene_create_raster_shell: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number) => void;
    readonly browserscene_create_shape_set: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly browserscene_destroy: (a: number) => void;
    readonly browserscene_dispose_draw_set: (a: number, b: number, c: number) => void;
    readonly browserscene_drill_pick: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly browserscene_force_render: (a: number, b: number, c: number) => void;
    readonly browserscene_get_split_position: (a: number) => number;
    readonly browserscene_globe_pending_tiles: (a: number) => number;
    readonly browserscene_globe_visible: (a: number) => number;
    readonly browserscene_has_shown_tileset: (a: number) => number;
    readonly browserscene_icons_ready: (a: number) => number;
    readonly browserscene_initialize_frame: (a: number, b: number, c: number) => void;
    readonly browserscene_is_destroyed: (a: number) => number;
    readonly browserscene_is_ellipsoid_terrain: (a: number) => number;
    readonly browserscene_is_imagery_layer_drawn: (a: number, b: number) => number;
    readonly browserscene_is_occluded: (a: number, b: number, c: number, d: number) => number;
    readonly browserscene_load_ion_terrain: (a: number, b: bigint, c: number, d: number, e: number) => number;
    readonly browserscene_load_ion_tileset: (a: number, b: bigint, c: number, d: number) => number;
    readonly browserscene_load_model_bytes: (a: number, b: number, c: number, d: number, e: number) => number;
    readonly browserscene_load_model_url: (a: number, b: number, c: number) => number;
    readonly browserscene_load_terrain_url: (a: number, b: number, c: number, d: number) => number;
    readonly browserscene_load_tileset_url: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => number;
    readonly browserscene_lower_imagery: (a: number, b: number) => void;
    readonly browserscene_model_info: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly browserscene_models_ready: (a: number) => number;
    readonly browserscene_move_imagery_layer: (a: number, b: number, c: number, d: number) => void;
    readonly browserscene_new: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly browserscene_patch_icons: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly browserscene_patch_points: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly browserscene_photoreal_tiles_loaded: (a: number) => number;
    readonly browserscene_pick: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly browserscene_pick_ellipsoid: (a: number, b: number, c: number, d: number) => void;
    readonly browserscene_pick_globe_ray: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly browserscene_pick_position: (a: number, b: number, c: number, d: number) => void;
    readonly browserscene_pick_position_supported: (a: number) => number;
    readonly browserscene_raise_imagery: (a: number, b: number) => void;
    readonly browserscene_ray_cast: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => void;
    readonly browserscene_read_pixels: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly browserscene_remove_icon: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly browserscene_remove_imagery: (a: number, b: number) => void;
    readonly browserscene_remove_model: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly browserscene_remove_post_process_stage: (a: number, b: number, c: number) => void;
    readonly browserscene_remove_raster_shell: (a: number, b: number, c: number) => void;
    readonly browserscene_remove_texture: (a: number, b: number, c: number) => void;
    readonly browserscene_render: (a: number, b: number, c: number) => void;
    readonly browserscene_render_requested: (a: number) => number;
    readonly browserscene_rendered_globe_tiles: (a: number) => number;
    readonly browserscene_replace_lines: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly browserscene_replace_points: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly browserscene_replace_shapes: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly browserscene_request_render: (a: number) => void;
    readonly browserscene_resize: (a: number, b: number, c: number, d: number) => void;
    readonly browserscene_sample_height_now: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly browserscene_sample_height_supported: (a: number) => number;
    readonly browserscene_sample_terrain_finest: (a: number, b: number, c: number) => number;
    readonly browserscene_set_bloom: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => void;
    readonly browserscene_set_camera_controller_options: (a: number, b: number, c: number, d: number) => void;
    readonly browserscene_set_camera_pose: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number) => void;
    readonly browserscene_set_draw_set_blend: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly browserscene_set_draw_set_height_query: (a: number, b: number, c: number, d: number) => void;
    readonly browserscene_set_draw_set_order: (a: number, b: number, c: number, d: number) => void;
    readonly browserscene_set_draw_set_pickable: (a: number, b: number, c: number, d: number) => void;
    readonly browserscene_set_draw_set_show: (a: number, b: number, c: number, d: number) => void;
    readonly browserscene_set_globe_visible: (a: number, b: number) => void;
    readonly browserscene_set_imagery_alpha: (a: number, b: number, c: number) => void;
    readonly browserscene_set_imagery_show: (a: number, b: number, c: number) => void;
    readonly browserscene_set_imagery_split_direction: (a: number, b: number, c: number) => void;
    readonly browserscene_set_model_node_matrix: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly browserscene_set_model_parts: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => void;
    readonly browserscene_set_photoreal_show: (a: number, b: number) => void;
    readonly browserscene_set_photoreal_tileset: (a: number, b: number) => void;
    readonly browserscene_set_post_process_stage_enabled: (a: number, b: number, c: number, d: number) => void;
    readonly browserscene_set_post_process_stage_uniforms: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly browserscene_set_sky: (a: number, b: number, c: number, d: number) => void;
    readonly browserscene_set_split_position: (a: number, b: number) => void;
    readonly browserscene_set_surface_shading: (a: number, b: number, c: number) => void;
    readonly browserscene_set_terrain_ellipsoid: (a: number, b: number) => void;
    readonly browserscene_set_vertical_exaggeration: (a: number, b: number) => void;
    readonly browserscene_step_camera_controller: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number, n: number, o: number, p: number, q: number, r: number, s: number, t: number) => void;
    readonly browserscene_tiles_loaded: (a: number) => number;
    readonly browserscene_update_model: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly browserscene_update_raster_shell: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number) => void;
    readonly browserscene_upload_texture_rgba: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => void;
    readonly browserscene_upsert_icon_rgba: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
    readonly browserscene_upsert_icons_cached: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly browserscreenspaceeventhandler_destroy: (a: number) => void;
    readonly browserscreenspaceeventhandler_getInputAction: (a: number, b: number, c: number) => number;
    readonly browserscreenspaceeventhandler_isDestroyed: (a: number) => number;
    readonly browserscreenspaceeventhandler_new: (a: number, b: number) => void;
    readonly browserscreenspaceeventhandler_removeInputAction: (a: number, b: number, c: number, d: number) => void;
    readonly build_geodesic_mesh: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly build_globe_mesh: (a: number, b: number) => void;
    readonly build_graticule_mesh: (a: number) => void;
    readonly build_star_mesh: (a: number, b: number) => void;
    readonly build_tile_mesh: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly camera_look_at: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => void;
    readonly ecef_to_llh: (a: number, b: number, c: number) => void;
    readonly f32_len: () => number;
    readonly f32_ptr: () => number;
    readonly f64_len: () => number;
    readonly f64_ptr: () => number;
    readonly geodesic_info: (a: number, b: number, c: number, d: number) => void;
    readonly llh_to_ecef: (a: number, b: number, c: number) => void;
    readonly browserscreenspaceeventhandler_setInputAction: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly pick_ndc: (a: number, b: number) => void;
    readonly radians: (a: number) => number;
    readonly suggested_level: (a: number) => number;
    readonly sun_direction: (a: number) => void;
    readonly u32_len: () => number;
    readonly u32_ptr: () => number;
    readonly loadedterrain_has_vertex_normals: (a: number) => number;
    readonly writeTextToCanvas: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_14466: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_14468: (a: number, b: number, c: number, d: number) => void;
    readonly __wasm_bindgen_func_elem_5360: (a: number, b: number, c: number) => number;
    readonly __wbindgen_export: (a: number, b: number) => number;
    readonly __wbindgen_export2: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_export3: (a: number) => void;
    readonly __wbindgen_export4: (a: number, b: number) => void;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_export5: (a: number, b: number, c: number) => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
