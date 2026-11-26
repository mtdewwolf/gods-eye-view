/* @ts-self-types="./cesium_rs.d.ts" */
import { abortJob, canvasContext, createCanvas, creditElement, decodeImage, decodeResourceImage, dimensions, imageFromRgba, imagePixels, measureCanvasText, removeScreenListeners, resizeImage, screenListeners, startImageRequest, startRequest } from './snippets/cesium-rs-a4810d90f4c4785b/web/host/core.mjs';
import { default as _default } from './snippets/cesium-rs-a4810d90f4c4785b/web/host/vendor/purify.es.mjs';


/**
 * Ready-to-use browser entry points. Rust applications can also use the
 * individual adapters without this wasm-bindgen facade.
 */
export class BrowserCore {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BrowserCoreFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_browsercore_free(ptr, 0);
    }
    /**
     * @param {string} host
     * @param {number} port
     */
    addTrustedServer(host, port) {
        const ptr0 = passStringToWasm0(host, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.browsercore_addTrustedServer(this.__wbg_ptr, ptr0, len0, port);
    }
    /**
     * @param {string} html
     * @param {boolean} show_on_screen
     * @returns {any}
     */
    creditElement(html, show_on_screen) {
        const ptr0 = passStringToWasm0(html, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.browsercore_creditElement(this.__wbg_ptr, ptr0, len0, show_on_screen);
        return takeObject(ret);
    }
    /**
     * @param {string} url
     * @param {boolean} flip_y
     * @param {boolean} skip_color_space_conversion
     * @returns {Promise<any>}
     */
    fetchImage(url, flip_y, skip_color_space_conversion) {
        const ptr0 = passStringToWasm0(url, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.browsercore_fetchImage(this.__wbg_ptr, ptr0, len0, flip_y, skip_color_space_conversion);
        return takeObject(ret);
    }
    /**
     * @param {string} url
     * @returns {Promise<any>}
     */
    fetchJson(url) {
        const ptr0 = passStringToWasm0(url, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.browsercore_fetchJson(this.__wbg_ptr, ptr0, len0);
        return takeObject(ret);
    }
    constructor() {
        const ret = wasm.browsercore_new();
        this.__wbg_ptr = ret;
        BrowserCoreFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
    /**
     * @param {Uint8Array} bytes
     * @param {number} width
     * @param {number} height
     * @returns {any}
     */
    rgbaCanvas(bytes, width, height) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.browsercore_rgbaCanvas(retptr, this.__wbg_ptr, ptr0, len0, width, height);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return takeObject(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {Uint8Array} bytes
     * @param {any} formats
     * @returns {Promise<any>}
     */
    transcodeKtx2(bytes, formats) {
        const ptr0 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.browsercore_transcodeKtx2(this.__wbg_ptr, ptr0, len0, addHeapObject(formats));
        return takeObject(ret);
    }
}
if (Symbol.dispose) BrowserCore.prototype[Symbol.dispose] = BrowserCore.prototype.free;

export class BrowserPinBuilder {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BrowserPinBuilderFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_browserpinbuilder_free(ptr, 0);
    }
    /**
     * @param {any} c
     * @param {number} size
     * @returns {any}
     */
    fromColor(c, size) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.browserpinbuilder_fromColor(retptr, this.__wbg_ptr, addHeapObject(c), size);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return takeObject(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} id
     * @param {any} c
     * @param {number} size
     * @param {string} base_url
     * @returns {Promise<any>}
     */
    fromMakiIconId(id, c, size, base_url) {
        const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(base_url, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.browserpinbuilder_fromMakiIconId(this.__wbg_ptr, ptr0, len0, addHeapObject(c), size, ptr1, len1);
        return takeObject(ret);
    }
    /**
     * @param {string} text
     * @param {any} c
     * @param {number} size
     * @returns {any}
     */
    fromText(text, c, size) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.browserpinbuilder_fromText(retptr, this.__wbg_ptr, ptr0, len0, addHeapObject(c), size);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return takeObject(r0);
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} url
     * @param {any} c
     * @param {number} size
     * @returns {Promise<any>}
     */
    fromUrl(url, c, size) {
        const ptr0 = passStringToWasm0(url, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.browserpinbuilder_fromUrl(this.__wbg_ptr, ptr0, len0, addHeapObject(c), size);
        return takeObject(ret);
    }
    constructor() {
        const ret = wasm.browserpinbuilder_new();
        this.__wbg_ptr = ret;
        BrowserPinBuilderFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) BrowserPinBuilder.prototype[Symbol.dispose] = BrowserPinBuilder.prototype.free;

export class BrowserScene {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BrowserSceneFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_browserscene_free(ptr, 0);
    }
    /**
     * Adds a JS-callback-backed imagery layer (powers `imageHooks`, `vectorBase`,
     * `imageryFrames`, `imageryDecoded`, and custom tile hooks).
     * @param {Function} callback
     * @param {boolean} geographic
     * @param {boolean} single_tile
     * @param {number} west_deg
     * @param {number} south_deg
     * @param {number} east_deg
     * @param {number} north_deg
     * @param {number} min_level
     * @param {number} max_level
     * @param {number} tile_size
     * @param {number} alpha
     * @param {boolean} show
     * @param {number} split_dir
     * @param {number} min_terrain_level
     * @param {string} credit_text
     * @param {number} index
     * @param {boolean} on_tileset
     * @returns {number}
     */
    add_js_imagery(callback, geographic, single_tile, west_deg, south_deg, east_deg, north_deg, min_level, max_level, tile_size, alpha, show, split_dir, min_terrain_level, credit_text, index, on_tileset) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(credit_text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.browserscene_add_js_imagery(retptr, this.__wbg_ptr, addHeapObject(callback), geographic, single_tile, west_deg, south_deg, east_deg, north_deg, min_level, max_level, tile_size, alpha, show, split_dir, min_terrain_level, ptr0, len0, index, on_tileset);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return r0 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} name
     * @param {string} fragment_shader
     * @param {string} uniforms_json
     * @param {boolean} enabled
     */
    add_post_process_stage(name, fragment_shader, uniforms_json, enabled) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(fragment_shader, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            const ptr2 = passStringToWasm0(uniforms_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len2 = WASM_VECTOR_LEN;
            wasm.browserscene_add_post_process_stage(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, enabled);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Adds a single-image imagery layer over a geodetic rectangle.
     * @param {string} url
     * @param {number} west_deg
     * @param {number} south_deg
     * @param {number} east_deg
     * @param {number} north_deg
     * @param {number} tile_width
     * @param {number} tile_height
     * @param {number} alpha
     * @param {boolean} show
     * @param {string} credit_text
     * @param {number} index
     * @returns {number}
     */
    add_single_image_imagery(url, west_deg, south_deg, east_deg, north_deg, tile_width, tile_height, alpha, show, credit_text, index) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(url, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(credit_text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.browserscene_add_single_image_imagery(retptr, this.__wbg_ptr, ptr0, len0, west_deg, south_deg, east_deg, north_deg, tile_width, tile_height, alpha, show, ptr1, len1, index);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return r0 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Adds a Web Mercator or Geographic XYZ URL template imagery layer.
     * @param {string} url
     * @param {string} subdomains_json
     * @param {boolean} geographic
     * @param {number} west_deg
     * @param {number} south_deg
     * @param {number} east_deg
     * @param {number} north_deg
     * @param {number} min_level
     * @param {number} max_level
     * @param {number} tile_size
     * @param {number} alpha
     * @param {boolean} show
     * @param {string} credit_text
     * @param {number} index
     * @returns {number}
     */
    add_xyz_imagery(url, subdomains_json, geographic, west_deg, south_deg, east_deg, north_deg, min_level, max_level, tile_size, alpha, show, credit_text, index) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(url, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(subdomains_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            const ptr2 = passStringToWasm0(credit_text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len2 = WASM_VECTOR_LEN;
            wasm.browserscene_add_xyz_imagery(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1, geographic, west_deg, south_deg, east_deg, north_deg, min_level, max_level, tile_size, alpha, show, ptr2, len2, index);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return r0 >>> 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Applies an async-loaded terrain provider synchronously to the globe.
     * @param {LoadedTerrain} terrain
     * @param {number} exaggeration
     */
    apply_loaded_terrain(terrain, exaggeration) {
        _assertClass(terrain, LoadedTerrain);
        wasm.browserscene_apply_loaded_terrain(this.__wbg_ptr, terrain.__wbg_ptr, exaggeration);
    }
    /**
     * @param {string} set_id
     * @param {string} item_id
     * @param {LoadedModel} loaded
     * @param {string} options_json
     */
    attach_model(set_id, item_id, loaded, options_json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(item_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            _assertClass(loaded, LoadedModel);
            var ptr2 = loaded.__destroy_into_raw();
            const ptr3 = passStringToWasm0(options_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len3 = WASM_VECTOR_LEN;
            wasm.browserscene_attach_model(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, ptr3, len3);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} kind
     * @param {string} modifier
     * @param {number} x
     * @param {number} y
     * @param {number} end_x
     * @param {number} end_y
     * @param {number} wheel_delta
     * @param {number} time_ms
     */
    camera_input_event(kind, modifier, x, y, end_x, end_y, wheel_delta, time_ms) {
        const ptr0 = passStringToWasm0(kind, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(modifier, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.browserscene_camera_input_event(this.__wbg_ptr, ptr0, len0, ptr1, len1, x, y, end_x, end_y, wheel_delta, time_ms);
    }
    /**
     * @param {string} set_id
     */
    clear_icon_set(set_id) {
        const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.browserscene_clear_icon_set(this.__wbg_ptr, ptr0, len0);
    }
    clear_imagery() {
        wasm.browserscene_clear_imagery(this.__wbg_ptr);
    }
    /**
     * @param {string} set_id
     */
    clear_models(set_id) {
        const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.browserscene_clear_models(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {string} id
     * @param {boolean} show
     * @param {boolean} pickable
     * @param {number} draw_order
     */
    create_icon_set(id, show, pickable, draw_order) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.browserscene_create_icon_set(retptr, this.__wbg_ptr, ptr0, len0, show, pickable, draw_order);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} id
     * @param {boolean} show
     * @param {boolean} pickable
     * @param {number} draw_order
     */
    create_line_set(id, show, pickable, draw_order) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.browserscene_create_line_set(retptr, this.__wbg_ptr, ptr0, len0, show, pickable, draw_order);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} id
     * @param {boolean} show
     * @param {boolean} pickable
     * @param {number} draw_order
     */
    create_model_set(id, show, pickable, draw_order) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.browserscene_create_model_set(retptr, this.__wbg_ptr, ptr0, len0, show, pickable, draw_order);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} id
     * @param {boolean} show
     * @param {boolean} pickable
     * @param {number} draw_order
     */
    create_point_set(id, show, pickable, draw_order) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.browserscene_create_point_set(retptr, this.__wbg_ptr, ptr0, len0, show, pickable, draw_order);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} id
     * @param {number} west_deg
     * @param {number} south_deg
     * @param {number} east_deg
     * @param {number} north_deg
     * @param {number} height_m
     * @param {string} image_tex_id
     * @param {string} detail_tex_id
     * @param {Float64Array} window
     * @param {number} alpha
     * @param {number} lift_m
     * @param {boolean} show
     */
    create_raster_shell(id, west_deg, south_deg, east_deg, north_deg, height_m, image_tex_id, detail_tex_id, window, alpha, lift_m, show) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(image_tex_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            const ptr2 = passStringToWasm0(detail_tex_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len2 = WASM_VECTOR_LEN;
            const ptr3 = passArrayF64ToWasm0(window, wasm.__wbindgen_export);
            const len3 = WASM_VECTOR_LEN;
            wasm.browserscene_create_raster_shell(retptr, this.__wbg_ptr, ptr0, len0, west_deg, south_deg, east_deg, north_deg, height_m, ptr1, len1, ptr2, len2, ptr3, len3, alpha, lift_m, show);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} id
     * @param {boolean} show
     * @param {boolean} pickable
     * @param {number} draw_order
     */
    create_shape_set(id, show, pickable, draw_order) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.browserscene_create_shape_set(retptr, this.__wbg_ptr, ptr0, len0, show, pickable, draw_order);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    destroy() {
        wasm.browserscene_destroy(this.__wbg_ptr);
    }
    /**
     * @param {string} set_id
     */
    dispose_draw_set(set_id) {
        const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.browserscene_dispose_draw_set(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * GPU multi-hit drill pick at CSS pixel `(x, y)` returning `"{set_id}\0{item_id}"` entries.
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @param {number} limit
     * @returns {string[]}
     */
    drill_pick(x, y, width, height, limit) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.browserscene_drill_pick(retptr, this.__wbg_ptr, x, y, width, height, limit);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeObject(r2);
            }
            var v1 = getArrayJsValueFromWasm0(r0, r1);
            wasm.__wbindgen_export5(r0, r1 * 4, 4);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} epoch_ms
     * @returns {boolean}
     */
    force_render(epoch_ms) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.browserscene_force_render(retptr, this.__wbg_ptr, epoch_ms);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return r0 !== 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {number}
     */
    get_split_position() {
        const ret = wasm.browserscene_get_split_position(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    globe_pending_tiles() {
        const ret = wasm.browserscene_globe_pending_tiles(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {boolean}
     */
    globe_visible() {
        const ret = wasm.browserscene_globe_visible(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    has_shown_tileset() {
        const ret = wasm.browserscene_has_shown_tileset(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    icons_ready() {
        const ret = wasm.browserscene_icons_ready(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {number} monotonic_seconds
     */
    initialize_frame(monotonic_seconds) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.browserscene_initialize_frame(retptr, this.__wbg_ptr, monotonic_seconds);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {boolean}
     */
    is_destroyed() {
        const ret = wasm.browserscene_is_destroyed(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {boolean}
     */
    is_ellipsoid_terrain() {
        const ret = wasm.browserscene_is_ellipsoid_terrain(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Returns true if every currently rendered globe tile intersecting this layer's
     * rectangle has drawn this layer from its own imagery (or settled on failure).
     * @param {number} id
     * @returns {boolean}
     */
    is_imagery_layer_drawn(id) {
        const ret = wasm.browserscene_is_imagery_layer_drawn(this.__wbg_ptr, id);
        return ret !== 0;
    }
    /**
     * Whether an ECEF point is occluded behind the WGS84 ellipsoid horizon from the current eye.
     * @param {number} x
     * @param {number} y
     * @param {number} z
     * @returns {boolean}
     */
    is_occluded(x, y, z) {
        const ret = wasm.browserscene_is_occluded(this.__wbg_ptr, x, y, z);
        return ret !== 0;
    }
    /**
     * Asynchronously loads a Cesium ion terrain asset (e.g. World Terrain asset 1).
     * @param {bigint} asset_id
     * @param {string} access_token
     * @param {boolean} request_vertex_normals
     * @returns {Promise<any>}
     */
    load_ion_terrain(asset_id, access_token, request_vertex_normals) {
        const ptr0 = passStringToWasm0(access_token, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.browserscene_load_ion_terrain(this.__wbg_ptr, asset_id, ptr0, len0, request_vertex_normals);
        return takeObject(ret);
    }
    /**
     * Asynchronously loads a 3D Tileset from Cesium ion (e.g. Google Photorealistic 3D Tiles asset 2275207).
     * @param {bigint} asset_id
     * @param {string} access_token
     * @returns {Promise<any>}
     */
    load_ion_tileset(asset_id, access_token) {
        const ptr0 = passStringToWasm0(access_token, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.browserscene_load_ion_tileset(this.__wbg_ptr, asset_id, ptr0, len0);
        return takeObject(ret);
    }
    /**
     * @param {string} url
     * @param {Uint8Array} bytes
     * @returns {Promise<any>}
     */
    load_model_bytes(url, bytes) {
        const ptr0 = passStringToWasm0(url, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passArray8ToWasm0(bytes, wasm.__wbindgen_export);
        const len1 = WASM_VECTOR_LEN;
        const ret = wasm.browserscene_load_model_bytes(this.__wbg_ptr, ptr0, len0, ptr1, len1);
        return takeObject(ret);
    }
    /**
     * @param {string} url
     * @returns {Promise<any>}
     */
    load_model_url(url) {
        const ptr0 = passStringToWasm0(url, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.browserscene_load_model_url(this.__wbg_ptr, ptr0, len0);
        return takeObject(ret);
    }
    /**
     * Asynchronously loads a quantized-mesh/heightmap terrain provider from a URL.
     * @param {string} url
     * @param {boolean} request_vertex_normals
     * @returns {Promise<any>}
     */
    load_terrain_url(url, request_vertex_normals) {
        const ptr0 = passStringToWasm0(url, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.browserscene_load_terrain_url(this.__wbg_ptr, ptr0, len0, request_vertex_normals);
        return takeObject(ret);
    }
    /**
     * Asynchronously loads a 3D Tileset from a URL (with optional Authorization header).
     * @param {string} url
     * @param {string | null | undefined} auth_header
     * @param {string} credit_text
     * @returns {Promise<any>}
     */
    load_tileset_url(url, auth_header, credit_text) {
        const ptr0 = passStringToWasm0(url, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        var ptr1 = isLikeNone(auth_header) ? 0 : passStringToWasm0(auth_header, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        var len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(credit_text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len2 = WASM_VECTOR_LEN;
        const ret = wasm.browserscene_load_tileset_url(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
        return takeObject(ret);
    }
    /**
     * @param {number} id
     */
    lower_imagery(id) {
        wasm.browserscene_lower_imagery(this.__wbg_ptr, id);
    }
    /**
     * Returns `[ready (0/1), bounding_radius, computed_scale]` for a model item, or empty if absent.
     * @param {string} set_id
     * @param {string} item_id
     * @returns {Float64Array}
     */
    model_info(set_id, item_id) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(item_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.browserscene_model_info(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v3 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export5(r0, r1 * 8, 8);
            return v3;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {boolean}
     */
    models_ready() {
        const ret = wasm.browserscene_models_ready(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Moves an imagery layer between the globe and the photoreal 3D tileset (or reorders it at `index`).
     * @param {number} id
     * @param {boolean} to_tileset
     * @param {number} index
     */
    move_imagery_layer(id, to_tileset, index) {
        wasm.browserscene_move_imagery_layer(this.__wbg_ptr, id, to_tileset, index);
    }
    /**
     * Creates a new WebGL2 `Scene` + `Globe` over an existing WebGL2 context.
     * @param {any} gl
     * @param {number} width
     * @param {number} height
     * @param {number} pixel_ratio
     * @param {number} epoch_ms
     */
    constructor(gl, width, height, pixel_ratio, epoch_ms) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.browserscene_new(retptr, addHeapObject(gl), width, height, pixel_ratio, epoch_ms);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            this.__wbg_ptr = r0;
            BrowserSceneFinalization.register(this, this.__wbg_ptr, this);
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} set_id
     * @param {string} patches_json
     */
    patch_icons(set_id, patches_json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(patches_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.browserscene_patch_icons(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} set_id
     * @param {string} patches_json
     */
    patch_points(set_id, patches_json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(patches_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.browserscene_patch_points(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {boolean}
     */
    photoreal_tiles_loaded() {
        const ret = wasm.browserscene_photoreal_tiles_loaded(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * GPU color pick at CSS pixel `(x, y)` with optional window `(w, h)`.
     * Returns `"{set_id}\0{item_id}"` or `None`, skipping unpickable (`\x01`-prefixed) items.
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @returns {string | undefined}
     */
    pick(x, y, width, height) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.browserscene_pick(retptr, this.__wbg_ptr, x, y, width, height);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeObject(r2);
            }
            let v1;
            if (r0 !== 0) {
                v1 = getStringFromWasm0(r0, r1);
                wasm.__wbindgen_export5(r0, r1 * 1, 1);
            }
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Ray-ellipsoid intersection for CSS pixel `(x, y)`. Returns `[x, y, z]` or empty.
     * @param {number} x
     * @param {number} y
     * @returns {Float64Array}
     */
    pick_ellipsoid(x, y) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.browserscene_pick_ellipsoid(retptr, this.__wbg_ptr, x, y);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export5(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Ray intersection against the globe surface (terrain tiles when loaded, else ellipsoid).
     * @param {number} ox
     * @param {number} oy
     * @param {number} oz
     * @param {number} dx
     * @param {number} dy
     * @param {number} dz
     * @returns {Float64Array}
     */
    pick_globe_ray(ox, oy, oz, dx, dy, dz) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.browserscene_pick_globe_ray(retptr, this.__wbg_ptr, ox, oy, oz, dx, dy, dz);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export5(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Depth-buffer pick at CSS pixel `(x, y)`. Returns `[x, y, z]` ECEF or empty.
     * @param {number} x
     * @param {number} y
     * @returns {Float64Array}
     */
    pick_position(x, y) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.browserscene_pick_position(retptr, this.__wbg_ptr, x, y);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v1 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export5(r0, r1 * 8, 8);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {boolean}
     */
    pick_position_supported() {
        const ret = wasm.browserscene_pick_position_supported(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {number} id
     */
    raise_imagery(id) {
        wasm.browserscene_raise_imagery(this.__wbg_ptr, id);
    }
    /**
     * Casts a ray against `'surface' | 'terrain' | 'tiles'` (excluding non-ground draw sets).
     * Returns `[x, y, z]` ECEF or empty Vec.
     * @param {number} ox
     * @param {number} oy
     * @param {number} oz
     * @param {number} dx
     * @param {number} dy
     * @param {number} dz
     * @param {string} against
     * @param {string} exclude_json
     * @param {number} max_distance
     * @returns {Float64Array}
     */
    ray_cast(ox, oy, oz, dx, dy, dz, against, exclude_json, max_distance) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(against, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(exclude_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.browserscene_ray_cast(retptr, this.__wbg_ptr, ox, oy, oz, dx, dy, dz, ptr0, len0, ptr1, len1, max_distance);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v3 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export5(r0, r1 * 8, 8);
            return v3;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Reads RGBA8 pixels from the default framebuffer (top-left origin flipped to standard ImageData order).
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     * @returns {Uint8Array}
     */
    read_pixels(x, y, width, height) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.browserscene_read_pixels(retptr, this.__wbg_ptr, x, y, width, height);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            var r3 = getDataViewMemory0().getInt32(retptr + 4 * 3, true);
            if (r3) {
                throw takeObject(r2);
            }
            var v1 = getArrayU8FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export5(r0, r1 * 1, 1);
            return v1;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} set_id
     * @param {string} item_id
     */
    remove_icon(set_id, item_id) {
        const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(item_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.browserscene_remove_icon(this.__wbg_ptr, ptr0, len0, ptr1, len1);
    }
    /**
     * @param {number} id
     */
    remove_imagery(id) {
        wasm.browserscene_remove_imagery(this.__wbg_ptr, id);
    }
    /**
     * @param {string} set_id
     * @param {string} item_id
     */
    remove_model(set_id, item_id) {
        const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(item_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.browserscene_remove_model(this.__wbg_ptr, ptr0, len0, ptr1, len1);
    }
    /**
     * @param {string} name
     */
    remove_post_process_stage(name) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.browserscene_remove_post_process_stage(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {string} id
     */
    remove_raster_shell(id) {
        const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.browserscene_remove_raster_shell(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {string} tex_id
     */
    remove_texture(tex_id) {
        const ptr0 = passStringToWasm0(tex_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.browserscene_remove_texture(this.__wbg_ptr, ptr0, len0);
    }
    /**
     * @param {number} epoch_ms
     * @returns {boolean}
     */
    render(epoch_ms) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.browserscene_render(retptr, this.__wbg_ptr, epoch_ms);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            return r0 !== 0;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {boolean}
     */
    render_requested() {
        const ret = wasm.browserscene_render_requested(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @returns {number}
     */
    rendered_globe_tiles() {
        const ret = wasm.browserscene_rendered_globe_tiles(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {string} set_id
     * @param {string} items_json
     */
    replace_lines(set_id, items_json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(items_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.browserscene_replace_lines(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} set_id
     * @param {string} items_json
     */
    replace_points(set_id, items_json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(items_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.browserscene_replace_points(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} set_id
     * @param {string} items_json
     */
    replace_shapes(set_id, items_json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(items_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.browserscene_replace_shapes(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    request_render() {
        wasm.browserscene_request_render(this.__wbg_ptr);
    }
    /**
     * @param {number} width
     * @param {number} height
     * @param {number} pixel_ratio
     */
    resize(width, height, pixel_ratio) {
        wasm.browserscene_resize(this.__wbg_ptr, width, height, pixel_ratio);
    }
    /**
     * Synchronous height query at `(lon_rad, lat_rad)` against `'surface' | 'terrain' | 'tiles'`.
     * Returns `[height_m, source_code]` where `source_code`: 0=ellipsoid, 1=terrain, 2=tiles, 3=set;
     * or empty Vec on miss. Draw sets without `include_in_height_queries` are ignored.
     * @param {number} lon_rad
     * @param {number} lat_rad
     * @param {string} against
     * @param {string} exclude_json
     * @returns {Float64Array}
     */
    sample_height_now(lon_rad, lat_rad, against, exclude_json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(against, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(exclude_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.browserscene_sample_height_now(retptr, this.__wbg_ptr, lon_rad, lat_rad, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v3 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export5(r0, r1 * 8, 8);
            return v3;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {boolean}
     */
    sample_height_supported() {
        const ret = wasm.browserscene_sample_height_supported(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * Samples the finest available terrain heights for packed `[lon_rad, lat_rad, ...]` coordinates.
     * Resolves to a `Float64Array`-compatible JS array of heights (NaN for misses).
     * @param {Float64Array} lon_lat_rad
     * @returns {Promise<any>}
     */
    sample_terrain_finest(lon_lat_rad) {
        const ptr0 = passArrayF64ToWasm0(lon_lat_rad, wasm.__wbindgen_export);
        const len0 = WASM_VECTOR_LEN;
        const ret = wasm.browserscene_sample_terrain_finest(this.__wbg_ptr, ptr0, len0);
        return takeObject(ret);
    }
    /**
     * @param {boolean} enabled
     * @param {number} contrast
     * @param {number} brightness
     * @param {number} delta
     * @param {number} sigma
     * @param {number} step_size
     */
    set_bloom(enabled, contrast, brightness, delta, sigma, step_size) {
        wasm.browserscene_set_bloom(this.__wbg_ptr, enabled, contrast, brightness, delta, sigma, step_size);
    }
    /**
     * @param {string} json
     */
    set_camera_controller_options(json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            wasm.browserscene_set_camera_controller_options(retptr, this.__wbg_ptr, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Synchronizes the Rust `Scene`'s camera from an exact ECEF eye pose and vertical FOV.
     * @param {number} px
     * @param {number} py
     * @param {number} pz
     * @param {number} dx
     * @param {number} dy
     * @param {number} dz
     * @param {number} ux
     * @param {number} uy
     * @param {number} uz
     * @param {number} rx
     * @param {number} ry
     * @param {number} rz
     * @param {number} fovy
     * @param {number} near
     * @param {number} far
     */
    set_camera_pose(px, py, pz, dx, dy, dz, ux, uy, uz, rx, ry, rz, fovy, near, far) {
        wasm.browserscene_set_camera_pose(this.__wbg_ptr, px, py, pz, dx, dy, dz, ux, uy, uz, rx, ry, rz, fovy, near, far);
    }
    /**
     * @param {string} set_id
     * @param {string} blend
     */
    set_draw_set_blend(set_id, blend) {
        const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(blend, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        wasm.browserscene_set_draw_set_blend(this.__wbg_ptr, ptr0, len0, ptr1, len1);
    }
    /**
     * @param {string} set_id
     * @param {boolean} include
     */
    set_draw_set_height_query(set_id, include) {
        const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.browserscene_set_draw_set_height_query(this.__wbg_ptr, ptr0, len0, include);
    }
    /**
     * @param {string} set_id
     * @param {number} draw_order
     */
    set_draw_set_order(set_id, draw_order) {
        const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.browserscene_set_draw_set_order(this.__wbg_ptr, ptr0, len0, draw_order);
    }
    /**
     * @param {string} set_id
     * @param {boolean} pickable
     */
    set_draw_set_pickable(set_id, pickable) {
        const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.browserscene_set_draw_set_pickable(this.__wbg_ptr, ptr0, len0, pickable);
    }
    /**
     * @param {string} set_id
     * @param {boolean} show
     */
    set_draw_set_show(set_id, show) {
        const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.browserscene_set_draw_set_show(this.__wbg_ptr, ptr0, len0, show);
    }
    /**
     * @param {boolean} visible
     */
    set_globe_visible(visible) {
        wasm.browserscene_set_globe_visible(this.__wbg_ptr, visible);
    }
    /**
     * @param {number} id
     * @param {number} alpha
     */
    set_imagery_alpha(id, alpha) {
        wasm.browserscene_set_imagery_alpha(this.__wbg_ptr, id, alpha);
    }
    /**
     * @param {number} id
     * @param {boolean} show
     */
    set_imagery_show(id, show) {
        wasm.browserscene_set_imagery_show(this.__wbg_ptr, id, show);
    }
    /**
     * @param {number} id
     * @param {number} dir
     */
    set_imagery_split_direction(id, dir) {
        wasm.browserscene_set_imagery_split_direction(this.__wbg_ptr, id, dir);
    }
    /**
     * @param {string} set_id
     * @param {string} item_id
     * @param {string} node_name
     * @param {Float64Array} matrix
     */
    set_model_node_matrix(set_id, item_id, node_name, matrix) {
        const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(item_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(node_name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArrayF64ToWasm0(matrix, wasm.__wbindgen_export);
        const len3 = WASM_VECTOR_LEN;
        wasm.browserscene_set_model_node_matrix(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3);
    }
    /**
     * @param {string} set_id
     * @param {string} item_id
     * @param {string} shading
     * @param {Float64Array} mask_rgb
     * @param {number} rows
     * @param {Float32Array} floats
     */
    set_model_parts(set_id, item_id, shading, mask_rgb, rows, floats) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(item_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            const ptr2 = passStringToWasm0(shading, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len2 = WASM_VECTOR_LEN;
            const ptr3 = passArrayF64ToWasm0(mask_rgb, wasm.__wbindgen_export);
            const len3 = WASM_VECTOR_LEN;
            const ptr4 = passArrayF32ToWasm0(floats, wasm.__wbindgen_export);
            const len4 = WASM_VECTOR_LEN;
            wasm.browserscene_set_model_parts(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, rows, ptr4, len4);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {boolean} show
     */
    set_photoreal_show(show) {
        wasm.browserscene_set_photoreal_show(this.__wbg_ptr, show);
    }
    /**
     * @param {LoadedTileset | null} [tileset]
     */
    set_photoreal_tileset(tileset) {
        let ptr0 = 0;
        if (!isLikeNone(tileset)) {
            _assertClass(tileset, LoadedTileset);
            ptr0 = tileset.__destroy_into_raw();
        }
        wasm.browserscene_set_photoreal_tileset(this.__wbg_ptr, ptr0);
    }
    /**
     * @param {string} name
     * @param {boolean} enabled
     */
    set_post_process_stage_enabled(name, enabled) {
        const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.browserscene_set_post_process_stage_enabled(this.__wbg_ptr, ptr0, len0, enabled);
    }
    /**
     * @param {string} name
     * @param {string} uniforms_json
     */
    set_post_process_stage_uniforms(name, uniforms_json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(name, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(uniforms_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.browserscene_set_post_process_stage_uniforms(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {boolean} atmosphere
     * @param {boolean} fog
     * @param {boolean} lighting
     */
    set_sky(atmosphere, fog, lighting) {
        wasm.browserscene_set_sky(this.__wbg_ptr, atmosphere, fog, lighting);
    }
    /**
     * @param {number} pos
     */
    set_split_position(pos) {
        wasm.browserscene_set_split_position(this.__wbg_ptr, pos);
    }
    /**
     * @param {boolean} enabled
     * @param {number} strength
     */
    set_surface_shading(enabled, strength) {
        wasm.browserscene_set_surface_shading(this.__wbg_ptr, enabled, strength);
    }
    /**
     * @param {number} exaggeration
     */
    set_terrain_ellipsoid(exaggeration) {
        wasm.browserscene_set_terrain_ellipsoid(this.__wbg_ptr, exaggeration);
    }
    /**
     * @param {number} exaggeration
     */
    set_vertical_exaggeration(exaggeration) {
        wasm.browserscene_set_vertical_exaggeration(this.__wbg_ptr, exaggeration);
    }
    /**
     * @param {number} time_ms
     * @param {number} px
     * @param {number} py
     * @param {number} pz
     * @param {number} dx
     * @param {number} dy
     * @param {number} dz
     * @param {number} ux
     * @param {number} uy
     * @param {number} uz
     * @param {number} rx
     * @param {number} ry
     * @param {number} rz
     * @param {number} fovy
     * @param {number} near
     * @param {number} far
     * @param {Float64Array} frame_matrix
     * @returns {Float64Array}
     */
    step_camera_controller(time_ms, px, py, pz, dx, dy, dz, ux, uy, uz, rx, ry, rz, fovy, near, far, frame_matrix) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passArrayF64ToWasm0(frame_matrix, wasm.__wbindgen_export);
            const len0 = WASM_VECTOR_LEN;
            wasm.browserscene_step_camera_controller(retptr, this.__wbg_ptr, time_ms, px, py, pz, dx, dy, dz, ux, uy, uz, rx, ry, rz, fovy, near, far, ptr0, len0);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var v2 = getArrayF64FromWasm0(r0, r1).slice();
            wasm.__wbindgen_export5(r0, r1 * 8, 8);
            return v2;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @returns {boolean}
     */
    tiles_loaded() {
        const ret = wasm.browserscene_tiles_loaded(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {string} set_id
     * @param {string} item_id
     * @param {string} options_json
     */
    update_model(set_id, item_id, options_json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(item_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            const ptr2 = passStringToWasm0(options_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len2 = WASM_VECTOR_LEN;
            wasm.browserscene_update_model(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {string} id
     * @param {string} image_tex_id
     * @param {string} detail_tex_id
     * @param {Float64Array} window
     * @param {number} alpha
     * @param {number} lift_m
     * @param {boolean} show
     */
    update_raster_shell(id, image_tex_id, detail_tex_id, window, alpha, lift_m, show) {
        const ptr0 = passStringToWasm0(id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        const ptr1 = passStringToWasm0(image_tex_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len1 = WASM_VECTOR_LEN;
        const ptr2 = passStringToWasm0(detail_tex_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len2 = WASM_VECTOR_LEN;
        const ptr3 = passArrayF64ToWasm0(window, wasm.__wbindgen_export);
        const len3 = WASM_VECTOR_LEN;
        wasm.browserscene_update_raster_shell(this.__wbg_ptr, ptr0, len0, ptr1, len1, ptr2, len2, ptr3, len3, alpha, lift_m, show);
    }
    /**
     * @param {string} tex_id
     * @param {number} width
     * @param {number} height
     * @param {Uint8Array} rgba
     */
    upload_texture_rgba(tex_id, width, height, rgba) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(tex_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passArray8ToWasm0(rgba, wasm.__wbindgen_export);
            const len1 = WASM_VECTOR_LEN;
            wasm.browserscene_upload_texture_rgba(retptr, this.__wbg_ptr, ptr0, len0, width, height, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Upserts one billboard icon using RGBA8 pixels decoded on the JS side.
     * When `image_id` is set and already uploaded to this icon set, `rgba` may be empty.
     * @param {string} set_id
     * @param {string} options_json
     * @param {number} img_width
     * @param {number} img_height
     * @param {Uint8Array} rgba
     */
    upsert_icon_rgba(set_id, options_json, img_width, img_height, rgba) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(options_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            const ptr2 = passArray8ToWasm0(rgba, wasm.__wbindgen_export);
            const len2 = WASM_VECTOR_LEN;
            wasm.browserscene_upsert_icon_rgba(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1, img_width, img_height, ptr2, len2);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * Batch-upserts icons whose `image_id` has already been uploaded into this icon set's atlas.
     * @param {string} set_id
     * @param {string} items_json
     */
    upsert_icons_cached(set_id, items_json) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            const ptr0 = passStringToWasm0(set_id, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len0 = WASM_VECTOR_LEN;
            const ptr1 = passStringToWasm0(items_json, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            wasm.browserscene_upsert_icons_cached(retptr, this.__wbg_ptr, ptr0, len0, ptr1, len1);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) BrowserScene.prototype[Symbol.dispose] = BrowserScene.prototype.free;

export class BrowserScreenSpaceEventHandler {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        BrowserScreenSpaceEventHandlerFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_browserscreenspaceeventhandler_free(ptr, 0);
    }
    destroy() {
        wasm.browserscreenspaceeventhandler_destroy(this.__wbg_ptr);
    }
    /**
     * @param {number} kind
     * @param {number | null} [modifier]
     * @returns {any}
     */
    getInputAction(kind, modifier) {
        const ret = wasm.browserscreenspaceeventhandler_getInputAction(this.__wbg_ptr, kind, isLikeNone(modifier) ? 0xFFFFFF : modifier);
        return takeObject(ret);
    }
    /**
     * @returns {boolean}
     */
    isDestroyed() {
        const ret = wasm.browserscreenspaceeventhandler_isDestroyed(this.__wbg_ptr);
        return ret !== 0;
    }
    /**
     * @param {any} element
     */
    constructor(element) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.browserscreenspaceeventhandler_new(retptr, addHeapObject(element));
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
            if (r2) {
                throw takeObject(r1);
            }
            this.__wbg_ptr = r0;
            BrowserScreenSpaceEventHandlerFinalization.register(this, this.__wbg_ptr, this);
            return this;
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {number} kind
     * @param {number | null} [modifier]
     */
    removeInputAction(kind, modifier) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.browserscreenspaceeventhandler_removeInputAction(retptr, this.__wbg_ptr, kind, isLikeNone(modifier) ? 0xFFFFFF : modifier);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
    /**
     * @param {Function} action
     * @param {number} kind
     * @param {number | null} [modifier]
     */
    setInputAction(action, kind, modifier) {
        try {
            const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
            wasm.browserscreenspaceeventhandler_setInputAction(retptr, this.__wbg_ptr, addHeapObject(action), kind, isLikeNone(modifier) ? 0xFFFFFF : modifier);
            var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
            var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
            if (r1) {
                throw takeObject(r0);
            }
        } finally {
            wasm.__wbindgen_add_to_stack_pointer(16);
        }
    }
}
if (Symbol.dispose) BrowserScreenSpaceEventHandler.prototype[Symbol.dispose] = BrowserScreenSpaceEventHandler.prototype.free;

/**
 * Async-loaded glTF/GLB model handle applied synchronously via `BrowserScene::attach_model`.
 */
export class LoadedModel {
    static __wrap(ptr) {
        const obj = Object.create(LoadedModel.prototype);
        obj.__wbg_ptr = ptr;
        LoadedModelFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        LoadedModelFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_loadedmodel_free(ptr, 0);
    }
}
if (Symbol.dispose) LoadedModel.prototype[Symbol.dispose] = LoadedModel.prototype.free;

/**
 * Async-loaded terrain handle applied synchronously via `BrowserScene::apply_loaded_terrain`.
 */
export class LoadedTerrain {
    static __wrap(ptr) {
        const obj = Object.create(LoadedTerrain.prototype);
        obj.__wbg_ptr = ptr;
        LoadedTerrainFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        LoadedTerrainFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_loadedterrain_free(ptr, 0);
    }
    /**
     * @returns {boolean}
     */
    has_vertex_normals() {
        const ret = wasm.loadedterrain_has_vertex_normals(this.__wbg_ptr);
        return ret !== 0;
    }
}
if (Symbol.dispose) LoadedTerrain.prototype[Symbol.dispose] = LoadedTerrain.prototype.free;

/**
 * Async-loaded 3D Tileset handle applied synchronously via `BrowserScene::set_photoreal_tileset`.
 */
export class LoadedTileset {
    static __wrap(ptr) {
        const obj = Object.create(LoadedTileset.prototype);
        obj.__wbg_ptr = ptr;
        LoadedTilesetFinalization.register(obj, obj.__wbg_ptr, obj);
        return obj;
    }
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        LoadedTilesetFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_loadedtileset_free(ptr, 0);
    }
}
if (Symbol.dispose) LoadedTileset.prototype[Symbol.dispose] = LoadedTileset.prototype.free;

/**
 * @param {string} text
 * @param {any} o
 * @returns {any}
 */
export function writeTextToCanvas(text, o) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        const ptr0 = passStringToWasm0(text, wasm.__wbindgen_export, wasm.__wbindgen_export2);
        const len0 = WASM_VECTOR_LEN;
        wasm.writeTextToCanvas(retptr, ptr0, len0, addHeapObject(o));
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        var r2 = getDataViewMemory0().getInt32(retptr + 4 * 2, true);
        if (r2) {
            throw takeObject(r1);
        }
        return takeObject(r0);
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_boolean_get_5b446f51afd21013: function(arg0) {
            const v = getObject(arg0);
            const ret = typeof(v) === 'boolean' ? v : undefined;
            return isLikeNone(ret) ? 0xFFFFFF : ret ? 1 : 0;
        },
        __wbg___wbindgen_debug_string_4687d8d8c2017d52: function(arg0, arg1) {
            const ret = debugString(getObject(arg1));
            const ptr1 = passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            const len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_is_falsy_16bd49b68658263e: function(arg0) {
            const ret = !getObject(arg0);
            return ret;
        },
        __wbg___wbindgen_is_function_1f9d30630b8b1d3d: function(arg0) {
            const ret = typeof(getObject(arg0)) === 'function';
            return ret;
        },
        __wbg___wbindgen_is_null_e343b7d08827ba72: function(arg0) {
            const ret = getObject(arg0) === null;
            return ret;
        },
        __wbg___wbindgen_is_undefined_8865fb403f8fe9d8: function(arg0) {
            const ret = getObject(arg0) === undefined;
            return ret;
        },
        __wbg___wbindgen_number_get_2e0e7dee9f701a71: function(arg0, arg1) {
            const obj = getObject(arg1);
            const ret = typeof(obj) === 'number' ? obj : undefined;
            getDataViewMemory0().setFloat64(arg0 + 8 * 1, isLikeNone(ret) ? 0 : ret, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, !isLikeNone(ret), true);
        },
        __wbg___wbindgen_string_get_0380ccaa2f57f0d9: function(arg0, arg1) {
            const obj = getObject(arg1);
            const ret = typeof(obj) === 'string' ? obj : undefined;
            var ptr1 = isLikeNone(ret) ? 0 : passStringToWasm0(ret, wasm.__wbindgen_export, wasm.__wbindgen_export2);
            var len1 = WASM_VECTOR_LEN;
            getDataViewMemory0().setInt32(arg0 + 4 * 1, len1, true);
            getDataViewMemory0().setInt32(arg0 + 4 * 0, ptr1, true);
        },
        __wbg___wbindgen_throw_41e9ee4f547fc59a: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg__wbg_cb_unref_dcc1a90847f04c41: function(arg0) {
            getObject(arg0)._wbg_cb_unref();
        },
        __wbg_abortJob_761f40e0968f4398: function(arg0) {
            abortJob(getObject(arg0));
        },
        __wbg_activeTexture_11079673eac5c921: function(arg0, arg1) {
            getObject(arg0).activeTexture(arg1 >>> 0);
        },
        __wbg_apply_a910804df6e1e433: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = getObject(arg0).apply(getObject(arg1), getObject(arg2));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_bindBuffer_0324f62b876c4403: function(arg0, arg1, arg2) {
            getObject(arg0).bindBuffer(arg1 >>> 0, getObject(arg2));
        },
        __wbg_bindFramebuffer_378eb18ef219d37a: function(arg0, arg1, arg2) {
            getObject(arg0).bindFramebuffer(arg1 >>> 0, getObject(arg2));
        },
        __wbg_bindRenderbuffer_e0c5aeef245a913a: function(arg0, arg1, arg2) {
            getObject(arg0).bindRenderbuffer(arg1 >>> 0, getObject(arg2));
        },
        __wbg_bindTexture_3cf008f256f3ed99: function(arg0, arg1, arg2) {
            getObject(arg0).bindTexture(arg1 >>> 0, getObject(arg2));
        },
        __wbg_bindVertexArray_f58af0a346185ec5: function(arg0, arg1) {
            getObject(arg0).bindVertexArray(getObject(arg1));
        },
        __wbg_blendColor_a6256f41d1925899: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).blendColor(arg1, arg2, arg3, arg4);
        },
        __wbg_blendEquationSeparate_fa2d4e5dde5ad8b3: function(arg0, arg1, arg2) {
            getObject(arg0).blendEquationSeparate(arg1 >>> 0, arg2 >>> 0);
        },
        __wbg_blendEquation_5fb8aee6a55cf900: function(arg0, arg1) {
            getObject(arg0).blendEquation(arg1 >>> 0);
        },
        __wbg_blendFuncSeparate_2af9d47f7efc0452: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).blendFuncSeparate(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
        },
        __wbg_blendFunc_589e4252bb396484: function(arg0, arg1, arg2) {
            getObject(arg0).blendFunc(arg1 >>> 0, arg2 >>> 0);
        },
        __wbg_bufferData_bad7ce562b6a9eac: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).bufferData(arg1 >>> 0, arg2, arg3 >>> 0);
        },
        __wbg_bufferData_ec7957bcbbf38591: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).bufferData(arg1 >>> 0, getArrayU8FromWasm0(arg2, arg3), arg4 >>> 0);
        },
        __wbg_bufferSubData_854b04baccbb2b76: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).bufferSubData(arg1 >>> 0, arg2, getArrayU8FromWasm0(arg3, arg4));
        },
        __wbg_buffer_56ec2905a66f58b9: function(arg0) {
            const ret = getObject(arg0).buffer;
            return addHeapObject(ret);
        },
        __wbg_call_1875a20c43a36133: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = getObject(arg0).call(getObject(arg1), getObject(arg2), getObject(arg3));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_call_187d372bd5fdd4aa: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = getObject(arg0).call(getObject(arg1), getObject(arg2));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_call_6137034ef55c9d0f: function() { return handleError(function (arg0, arg1) {
            const ret = getObject(arg0).call(getObject(arg1));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_call_939a2607c4484b0b: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            const ret = getObject(arg0).call(getObject(arg1), getObject(arg2), getObject(arg3), getObject(arg4));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_canvasContext_39c92ccb0c77f4d2: function() { return handleError(function (arg0) {
            const ret = canvasContext(getObject(arg0));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_clearColor_796427e8ac60fe14: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).clearColor(arg1, arg2, arg3, arg4);
        },
        __wbg_clearDepth_4840a5497ae51286: function(arg0, arg1) {
            getObject(arg0).clearDepth(arg1);
        },
        __wbg_clearStencil_e4383e4a543e7997: function(arg0, arg1) {
            getObject(arg0).clearStencil(arg1);
        },
        __wbg_clear_cb96796cc568b7c8: function(arg0, arg1) {
            getObject(arg0).clear(arg1 >>> 0);
        },
        __wbg_colorMask_4d6afbbbc3022fbe: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).colorMask(arg1 !== 0, arg2 !== 0, arg3 !== 0, arg4 !== 0);
        },
        __wbg_createCanvas_f8e852a4041a3101: function() { return handleError(function (arg0, arg1) {
            const ret = createCanvas(arg0 >>> 0, arg1 >>> 0);
            return addHeapObject(ret);
        }, arguments); },
        __wbg_creditElement_65b63dc7392b8ac0: function(arg0, arg1, arg2) {
            const ret = creditElement(getStringFromWasm0(arg0, arg1), arg2);
            return addHeapObject(ret);
        },
        __wbg_cullFace_12123c1c97f1ba2c: function(arg0, arg1) {
            getObject(arg0).cullFace(arg1 >>> 0);
        },
        __wbg_decodeImage_9d37d716648b163a: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4, arg5) {
            const ret = decodeImage(getArrayU8FromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3), arg4 !== 0, arg5 !== 0);
            return addHeapObject(ret);
        }, arguments); },
        __wbg_decodeResourceImage_3e345375dcc5a6dd: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            const ret = decodeResourceImage(getArrayU8FromWasm0(arg0, arg1), getStringFromWasm0(arg2, arg3), getObject(arg4));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_default_624cd6aa42ea7b57: function() {
            const ret = _default();
            return addHeapObject(ret);
        },
        __wbg_depthFunc_a41fb5adacb22e09: function(arg0, arg1) {
            getObject(arg0).depthFunc(arg1 >>> 0);
        },
        __wbg_depthMask_06ecff4d4514c38f: function(arg0, arg1) {
            getObject(arg0).depthMask(arg1 !== 0);
        },
        __wbg_depthRange_24c7969249461e8e: function(arg0, arg1, arg2) {
            getObject(arg0).depthRange(arg1, arg2);
        },
        __wbg_dimensions_a50b1f62b2503a38: function(arg0) {
            const ret = dimensions(getObject(arg0));
            return addHeapObject(ret);
        },
        __wbg_disableVertexAttribArray_c4c8af1f9e4120d4: function(arg0, arg1) {
            getObject(arg0).disableVertexAttribArray(arg1 >>> 0);
        },
        __wbg_disable_19fe787eccdf0272: function(arg0, arg1) {
            getObject(arg0).disable(arg1 >>> 0);
        },
        __wbg_drawArraysInstanced_9b44aa78a087154d: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).drawArraysInstanced(arg1 >>> 0, arg2, arg3, arg4);
        },
        __wbg_drawArrays_08872e02fb57b847: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).drawArrays(arg1 >>> 0, arg2, arg3);
        },
        __wbg_drawElementsInstanced_d7c396aa034159b6: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).drawElementsInstanced(arg1 >>> 0, arg2, arg3 >>> 0, arg4, arg5);
        },
        __wbg_drawElements_c8988ba71de1101a: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).drawElements(arg1 >>> 0, arg2, arg3 >>> 0, arg4);
        },
        __wbg_drawingBufferHeight_33542847e80b09a4: function(arg0) {
            const ret = getObject(arg0).drawingBufferHeight;
            return ret;
        },
        __wbg_drawingBufferWidth_7ddd0e8673c345e5: function(arg0) {
            const ret = getObject(arg0).drawingBufferWidth;
            return ret;
        },
        __wbg_enableVertexAttribArray_d52693866bc8b8dd: function(arg0, arg1) {
            getObject(arg0).enableVertexAttribArray(arg1 >>> 0);
        },
        __wbg_enable_cb4fc19b51148c37: function(arg0, arg1) {
            getObject(arg0).enable(arg1 >>> 0);
        },
        __wbg_error_a1da2ade730b7347: function(arg0, arg1) {
            console.error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_finish_173a156040775de3: function(arg0) {
            getObject(arg0).finish();
        },
        __wbg_flush_13b162660ad850d2: function(arg0) {
            getObject(arg0).flush();
        },
        __wbg_from_296ca31f8d0f1c52: function(arg0) {
            const ret = Array.from(getObject(arg0));
            return addHeapObject(ret);
        },
        __wbg_frontFace_6751b4b97f997aeb: function(arg0, arg1) {
            getObject(arg0).frontFace(arg1 >>> 0);
        },
        __wbg_getError_dd9903fdd93a6802: function(arg0) {
            const ret = getObject(arg0).getError();
            return ret;
        },
        __wbg_getExtension_abfda2c5db286b07: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = getObject(arg0).getExtension(getStringFromWasm0(arg1, arg2));
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        }, arguments); },
        __wbg_get_31af05bd4842a84f: function() { return handleError(function (arg0, arg1) {
            const ret = Reflect.get(getObject(arg0), getObject(arg1));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_get_6c896e0571ddae51: function(arg0, arg1) {
            const ret = getObject(arg0)[arg1 >>> 0];
            return addHeapObject(ret);
        },
        __wbg_get_unchecked_288889d017702237: function(arg0, arg1) {
            const ret = getObject(arg0)[arg1 >>> 0];
            return addHeapObject(ret);
        },
        __wbg_imageFromRgba_f8be8a096c08eef7: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = imageFromRgba(getArrayU8FromWasm0(arg0, arg1), arg2 >>> 0, arg3 >>> 0);
            return addHeapObject(ret);
        }, arguments); },
        __wbg_imagePixels_7cd92470548f6c71: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = imagePixels(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
            return addHeapObject(ret);
        }, arguments); },
        __wbg_instanceof_Promise_e1dc6893aa1ece28: function(arg0) {
            let result;
            try {
                result = getObject(arg0) instanceof Promise;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_WebGl2RenderingContext_64c994c14c0790fb: function(arg0) {
            let result;
            try {
                result = getObject(arg0) instanceof WebGL2RenderingContext;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_WebGlBuffer_2885781f1317c004: function(arg0) {
            let result;
            try {
                result = getObject(arg0) instanceof WebGLBuffer;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_WebGlFramebuffer_96954ddd437f6410: function(arg0) {
            let result;
            try {
                result = getObject(arg0) instanceof WebGLFramebuffer;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_WebGlProgram_feda10b96e9bf687: function(arg0) {
            let result;
            try {
                result = getObject(arg0) instanceof WebGLProgram;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_WebGlRenderbuffer_0ea3085e073822b3: function(arg0) {
            let result;
            try {
                result = getObject(arg0) instanceof WebGLRenderbuffer;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_WebGlTexture_d01b7a6d01a82da9: function(arg0) {
            let result;
            try {
                result = getObject(arg0) instanceof WebGLTexture;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_WebGlUniformLocation_43348da66c08716b: function(arg0) {
            let result;
            try {
                result = getObject(arg0) instanceof WebGLUniformLocation;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_instanceof_WebGlVertexArrayObject_4bfe0e166791cc36: function(arg0) {
            let result;
            try {
                result = getObject(arg0) instanceof WebGLVertexArrayObject;
            } catch (_) {
                result = false;
            }
            const ret = result;
            return ret;
        },
        __wbg_isArray_e15a2ff68ffdbef2: function(arg0) {
            const ret = Array.isArray(getObject(arg0));
            return ret;
        },
        __wbg_isView_87b70d94ddaa60d3: function(arg0) {
            const ret = ArrayBuffer.isView(getObject(arg0));
            return ret;
        },
        __wbg_is_4b278c0bd3caba97: function(arg0, arg1) {
            const ret = Object.is(getObject(arg0), getObject(arg1));
            return ret;
        },
        __wbg_length_7f3c00c40364105e: function(arg0) {
            const ret = getObject(arg0).length;
            return ret;
        },
        __wbg_length_d4bdea10311bd9cf: function(arg0) {
            const ret = getObject(arg0).length;
            return ret;
        },
        __wbg_lineWidth_99dad6c3b5ef0079: function(arg0, arg1) {
            getObject(arg0).lineWidth(arg1);
        },
        __wbg_loadedmodel_new: function(arg0) {
            const ret = LoadedModel.__wrap(arg0);
            return addHeapObject(ret);
        },
        __wbg_loadedterrain_new: function(arg0) {
            const ret = LoadedTerrain.__wrap(arg0);
            return addHeapObject(ret);
        },
        __wbg_loadedtileset_new: function(arg0) {
            const ret = LoadedTileset.__wrap(arg0);
            return addHeapObject(ret);
        },
        __wbg_measureCanvasText_50a33f3e9a137a5a: function() { return handleError(function (arg0, arg1, arg2, arg3, arg4) {
            const ret = measureCanvasText(getObject(arg0), getStringFromWasm0(arg1, arg2), getStringFromWasm0(arg3, arg4));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_new_17966584ea16a1c2: function(arg0) {
            const ret = new Uint16Array(getObject(arg0));
            return addHeapObject(ret);
        },
        __wbg_new_1dbf7428bba60a42: function(arg0) {
            const ret = new Uint8Array(getObject(arg0));
            return addHeapObject(ret);
        },
        __wbg_new_5502aad30c185fc8: function(arg0, arg1) {
            try {
                var state0 = {a: arg0, b: arg1};
                var cb0 = (arg0, arg1) => {
                    const a = state0.a;
                    state0.a = 0;
                    try {
                        return __wasm_bindgen_func_elem_14468(a, state0.b, arg0, arg1);
                    } finally {
                        state0.a = a;
                    }
                };
                const ret = new Promise(cb0);
                return addHeapObject(ret);
            } finally {
                state0.a = 0;
            }
        },
        __wbg_new_617a8cdb8bb1130e: function() {
            const ret = new Object();
            return addHeapObject(ret);
        },
        __wbg_new_63c4c65d2534e5d3: function(arg0) {
            const ret = new Float32Array(getObject(arg0));
            return addHeapObject(ret);
        },
        __wbg_new_74cd12440f4b8e4e: function(arg0) {
            const ret = new Uint32Array(getObject(arg0));
            return addHeapObject(ret);
        },
        __wbg_new_ee2291f50781bf1d: function() {
            const ret = new Array();
            return addHeapObject(ret);
        },
        __wbg_new_from_slice_37a3c3a194266cb8: function(arg0, arg1) {
            const ret = new Uint32Array(getArrayU32FromWasm0(arg0, arg1));
            return addHeapObject(ret);
        },
        __wbg_new_from_slice_911f717853b222c7: function(arg0, arg1) {
            const ret = new Int32Array(getArrayI32FromWasm0(arg0, arg1));
            return addHeapObject(ret);
        },
        __wbg_new_from_slice_9a868026ffa4208a: function(arg0, arg1) {
            const ret = new Uint8Array(getArrayU8FromWasm0(arg0, arg1));
            return addHeapObject(ret);
        },
        __wbg_new_from_slice_ca6ad97db1f4779a: function(arg0, arg1) {
            const ret = new Float32Array(getArrayF32FromWasm0(arg0, arg1));
            return addHeapObject(ret);
        },
        __wbg_new_from_slice_f545fd22ddc142b8: function(arg0, arg1) {
            const ret = new Float64Array(getArrayF64FromWasm0(arg0, arg1));
            return addHeapObject(ret);
        },
        __wbg_new_typed_b01cb72a8af741a3: function(arg0, arg1) {
            try {
                var state0 = {a: arg0, b: arg1};
                var cb0 = (arg0, arg1) => {
                    const a = state0.a;
                    state0.a = 0;
                    try {
                        return __wasm_bindgen_func_elem_14468(a, state0.b, arg0, arg1);
                    } finally {
                        state0.a = a;
                    }
                };
                const ret = new Promise(cb0);
                return addHeapObject(ret);
            } finally {
                state0.a = 0;
            }
        },
        __wbg_new_with_length_3827645dc5adb679: function(arg0) {
            const ret = new Float64Array(arg0 >>> 0);
            return addHeapObject(ret);
        },
        __wbg_now_aa4ccb83129e9e55: function() {
            const ret = Date.now();
            return ret;
        },
        __wbg_parse_0fc53dead14b3b42: function() { return handleError(function (arg0, arg1) {
            const ret = JSON.parse(getStringFromWasm0(arg0, arg1));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_pixelStorei_cb4e43466f5b8703: function(arg0, arg1, arg2) {
            getObject(arg0).pixelStorei(arg1 >>> 0, arg2);
        },
        __wbg_polygonOffset_81dc8ca84e29572b: function(arg0, arg1, arg2) {
            getObject(arg0).polygonOffset(arg1, arg2);
        },
        __wbg_prototypesetcall_bc27214492979395: function(arg0, arg1, arg2) {
            Uint8Array.prototype.set.call(getArrayU8FromWasm0(arg0, arg1), getObject(arg2));
        },
        __wbg_push_2baf45db356cf468: function(arg0, arg1) {
            const ret = getObject(arg0).push(getObject(arg1));
            return ret;
        },
        __wbg_queueMicrotask_9833f9a49df95a49: function(arg0) {
            const ret = getObject(arg0).queueMicrotask;
            return addHeapObject(ret);
        },
        __wbg_queueMicrotask_a72f977e97f23c5f: function(arg0) {
            queueMicrotask(getObject(arg0));
        },
        __wbg_removeScreenListeners_9ecb511975b4a8bb: function(arg0) {
            removeScreenListeners(getObject(arg0));
        },
        __wbg_resizeImage_b8a800676e6a27cc: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = resizeImage(getObject(arg0), arg1 >>> 0, arg2 >>> 0);
            return addHeapObject(ret);
        }, arguments); },
        __wbg_resolve_0076e10020304ede: function(arg0) {
            const ret = Promise.resolve(getObject(arg0));
            return addHeapObject(ret);
        },
        __wbg_scissor_12ddc324094acd50: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).scissor(arg1, arg2, arg3, arg4);
        },
        __wbg_screenListeners_bd479ef45133d12f: function() { return handleError(function (arg0, arg1) {
            const ret = screenListeners(getObject(arg0), getObject(arg1));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_set_145a351398b48c65: function() { return handleError(function (arg0, arg1, arg2) {
            const ret = Reflect.set(getObject(arg0), getObject(arg1), getObject(arg2));
            return ret;
        }, arguments); },
        __wbg_set_index_897c678888c01797: function(arg0, arg1, arg2) {
            getObject(arg0)[arg1 >>> 0] = arg2;
        },
        __wbg_startImageRequest_09cb1241bc2a04f1: function() { return handleError(function (arg0, arg1, arg2, arg3) {
            const ret = startImageRequest(getStringFromWasm0(arg0, arg1), arg2 !== 0, getObject(arg3));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_startRequest_5038cc5d9b336636: function() { return handleError(function (arg0) {
            const ret = startRequest(getObject(arg0));
            return addHeapObject(ret);
        }, arguments); },
        __wbg_static_accessor_GLOBAL_266715b9d96ba635: function() {
            const ret = typeof global === 'undefined' ? null : global;
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_static_accessor_GLOBAL_THIS_10fb7dc1ae063179: function() {
            const ret = typeof globalThis === 'undefined' ? null : globalThis;
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_static_accessor_SELF_0b583911f537483a: function() {
            const ret = typeof self === 'undefined' ? null : self;
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_static_accessor_WINDOW_d7f903d1508cbdc4: function() {
            const ret = typeof window === 'undefined' ? null : window;
            return isLikeNone(ret) ? 0 : addHeapObject(ret);
        },
        __wbg_stencilFuncSeparate_f168b66c597aa85f: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).stencilFuncSeparate(arg1 >>> 0, arg2 >>> 0, arg3, arg4 >>> 0);
        },
        __wbg_stencilFunc_bab7e0b7c443f093: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).stencilFunc(arg1 >>> 0, arg2, arg3 >>> 0);
        },
        __wbg_stencilMaskSeparate_b30c097ea6b98504: function(arg0, arg1, arg2) {
            getObject(arg0).stencilMaskSeparate(arg1 >>> 0, arg2 >>> 0);
        },
        __wbg_stencilMask_a22be64c66abd825: function(arg0, arg1) {
            getObject(arg0).stencilMask(arg1 >>> 0);
        },
        __wbg_stencilOpSeparate_c5af5f5dbd237bea: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).stencilOpSeparate(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0, arg4 >>> 0);
        },
        __wbg_stencilOp_2697194654fee819: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).stencilOp(arg1 >>> 0, arg2 >>> 0, arg3 >>> 0);
        },
        __wbg_texParameterf_46959960c830a629: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).texParameterf(arg1 >>> 0, arg2 >>> 0, arg3);
        },
        __wbg_texParameteri_7864076abcdb03e0: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).texParameteri(arg1 >>> 0, arg2 >>> 0, arg3);
        },
        __wbg_then_c949d5a25a4e78f8: function(arg0, arg1, arg2) {
            const ret = getObject(arg0).then(getObject(arg1), getObject(arg2));
            return addHeapObject(ret);
        },
        __wbg_then_e71170d78fcf8954: function(arg0, arg1) {
            const ret = getObject(arg0).then(getObject(arg1));
            return addHeapObject(ret);
        },
        __wbg_uniform1f_b5856e35a43b65a1: function(arg0, arg1, arg2) {
            getObject(arg0).uniform1f(getObject(arg1), arg2);
        },
        __wbg_uniform1fv_1bf537fc926ef8b9: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform1fv(getObject(arg1), getArrayF32FromWasm0(arg2, arg3));
        },
        __wbg_uniform1i_531b98c4a7177366: function(arg0, arg1, arg2) {
            getObject(arg0).uniform1i(getObject(arg1), arg2);
        },
        __wbg_uniform1iv_4b8cbceccddfaa62: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform1iv(getObject(arg1), getArrayI32FromWasm0(arg2, arg3));
        },
        __wbg_uniform2f_a92b5bb95dc5b4d9: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform2f(getObject(arg1), arg2, arg3);
        },
        __wbg_uniform2fv_319c49f0ce340f26: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform2fv(getObject(arg1), getArrayF32FromWasm0(arg2, arg3));
        },
        __wbg_uniform3f_1211579ff87ccfad: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniform3f(getObject(arg1), arg2, arg3, arg4);
        },
        __wbg_uniform3fv_055ea5ac38af4fce: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform3fv(getObject(arg1), getArrayF32FromWasm0(arg2, arg3));
        },
        __wbg_uniform4f_8dd8f311e656ca0d: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).uniform4f(getObject(arg1), arg2, arg3, arg4, arg5);
        },
        __wbg_uniform4fv_cf8ff646c36232c8: function(arg0, arg1, arg2, arg3) {
            getObject(arg0).uniform4fv(getObject(arg1), getArrayF32FromWasm0(arg2, arg3));
        },
        __wbg_uniformMatrix2fv_611c7fcb378f057e: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniformMatrix2fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
        },
        __wbg_uniformMatrix3fv_472e7824735acce1: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniformMatrix3fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
        },
        __wbg_uniformMatrix4fv_dff9738d995fd0b1: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).uniformMatrix4fv(getObject(arg1), arg2 !== 0, getArrayF32FromWasm0(arg3, arg4));
        },
        __wbg_useProgram_e075c2902e420761: function(arg0, arg1) {
            getObject(arg0).useProgram(getObject(arg1));
        },
        __wbg_vertexAttribDivisor_7575d382215322f7: function(arg0, arg1, arg2) {
            getObject(arg0).vertexAttribDivisor(arg1 >>> 0, arg2 >>> 0);
        },
        __wbg_vertexAttribIPointer_fc8057c62cfcc63c: function(arg0, arg1, arg2, arg3, arg4, arg5) {
            getObject(arg0).vertexAttribIPointer(arg1 >>> 0, arg2, arg3 >>> 0, arg4, arg5);
        },
        __wbg_vertexAttribPointer_24b495e18df325dc: function(arg0, arg1, arg2, arg3, arg4, arg5, arg6) {
            getObject(arg0).vertexAttribPointer(arg1 >>> 0, arg2, arg3 >>> 0, arg4 !== 0, arg5, arg6);
        },
        __wbg_viewport_16936692526e2ce6: function(arg0, arg1, arg2, arg3, arg4) {
            getObject(arg0).viewport(arg1, arg2, arg3, arg4);
        },
        __wbindgen_generic_0000000000000001: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [Externref], shim_idx: 2174, ret: Result(Unit), inner_ret: Some(Result(Unit)) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, __wasm_bindgen_func_elem_14466);
            return addHeapObject(ret);
        },
        __wbindgen_generic_0000000000000002: function(arg0, arg1) {
            // Cast intrinsic for `Closure(Closure { owned: true, function: Function { arguments: [Externref], shim_idx: 25, ret: Externref, inner_ret: Some(Externref) }, mutable: true }) -> Externref`.
            const ret = makeMutClosure(arg0, arg1, __wasm_bindgen_func_elem_5360);
            return addHeapObject(ret);
        },
        __wbindgen_generic_0000000000000003: function(arg0) {
            // Cast intrinsic for `F64 -> Externref`.
            const ret = arg0;
            return addHeapObject(ret);
        },
        __wbindgen_generic_0000000000000004: function(arg0, arg1) {
            // Cast intrinsic for `Ref(String) -> Externref`.
            const ret = getStringFromWasm0(arg0, arg1);
            return addHeapObject(ret);
        },
        __wbindgen_object_clone_ref: function(arg0) {
            const ret = getObject(arg0);
            return addHeapObject(ret);
        },
        __wbindgen_object_drop_ref: function(arg0) {
            takeObject(arg0);
        },
    };
    return {
        __proto__: null,
        "./cesium_rs_bg.js": import0,
    };
}

function __wasm_bindgen_func_elem_5360(arg0, arg1, arg2) {
    const ret = wasm.__wasm_bindgen_func_elem_5360(arg0, arg1, addHeapObject(arg2));
    return takeObject(ret);
}

function __wasm_bindgen_func_elem_14468(arg0, arg1, arg2, arg3) {
    wasm.__wasm_bindgen_func_elem_14468(arg0, arg1, addHeapObject(arg2), addHeapObject(arg3));
}

function __wasm_bindgen_func_elem_14466(arg0, arg1, arg2) {
    try {
        const retptr = wasm.__wbindgen_add_to_stack_pointer(-16);
        wasm.__wasm_bindgen_func_elem_14466(retptr, arg0, arg1, addHeapObject(arg2));
        var r0 = getDataViewMemory0().getInt32(retptr + 4 * 0, true);
        var r1 = getDataViewMemory0().getInt32(retptr + 4 * 1, true);
        if (r1) {
            throw takeObject(r0);
        }
    } finally {
        wasm.__wbindgen_add_to_stack_pointer(16);
    }
}

const BrowserCoreFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_browsercore_free(ptr, 1));
const BrowserPinBuilderFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_browserpinbuilder_free(ptr, 1));
const BrowserSceneFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_browserscene_free(ptr, 1));
const BrowserScreenSpaceEventHandlerFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_browserscreenspaceeventhandler_free(ptr, 1));
const LoadedModelFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_loadedmodel_free(ptr, 1));
const LoadedTerrainFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_loadedterrain_free(ptr, 1));
const LoadedTilesetFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_loadedtileset_free(ptr, 1));

function addHeapObject(obj) {
    if (heap_next === heap.length) heap.push(heap.length + 1);
    const idx = heap_next;
    heap_next = heap[idx];

    heap[idx] = obj;
    return idx;
}

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

const CLOSURE_DTORS = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(state => wasm.__wbindgen_export4(state.a, state.b));

function debugString(val) {
    // primitive types
    const type = typeof val;
    if (type == 'number' || type == 'boolean' || val == null) {
        return  `${val}`;
    }
    if (type == 'string') {
        return `"${val}"`;
    }
    if (type == 'symbol') {
        const description = val.description;
        if (description == null) {
            return 'Symbol';
        } else {
            return `Symbol(${description})`;
        }
    }
    if (type == 'function') {
        const name = val.name;
        if (typeof name == 'string' && name.length > 0) {
            return `Function(${name})`;
        } else {
            return 'Function';
        }
    }
    // objects
    if (Array.isArray(val)) {
        const length = val.length;
        let debug = '[';
        if (length > 0) {
            debug += debugString(val[0]);
        }
        for(let i = 1; i < length; i++) {
            debug += ', ' + debugString(val[i]);
        }
        debug += ']';
        return debug;
    }
    // Test for built-in
    const builtInMatches = /\[object ([^\]]+)\]/.exec(toString.call(val));
    let className;
    if (builtInMatches && builtInMatches.length > 1) {
        className = builtInMatches[1];
    } else {
        // Failed to match the standard '[object ClassName]'
        return toString.call(val);
    }
    if (className == 'Object') {
        // we're a user defined class or Object
        // JSON.stringify avoids problems with cycles, and is generally much
        // easier than looping through ownProperties of `val`.
        try {
            return 'Object(' + JSON.stringify(val) + ')';
        } catch (_) {
            return 'Object';
        }
    }
    // errors
    if (val instanceof Error) {
        return `${val.name}: ${val.message}\n${val.stack}`;
    }
    // TODO we could test for more things here, like `Set`s and `Map`s.
    return className;
}

function dropObject(idx) {
    if (idx < 1028) return;
    heap[idx] = heap_next;
    heap_next = idx;
}

function getArrayF32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayF64FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getFloat64ArrayMemory0().subarray(ptr / 8, ptr / 8 + len);
}

function getArrayI32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getInt32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayJsValueFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    const mem = getDataViewMemory0();
    const result = [];
    for (let i = ptr; i < ptr + 4 * len; i += 4) {
        result.push(takeObject(mem.getUint32(i, true)));
    }
    return result;
}

function getArrayU32FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint32ArrayMemory0().subarray(ptr / 4, ptr / 4 + len);
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedDataViewMemory0 = null;
function getDataViewMemory0() {
    if (cachedDataViewMemory0 === null || cachedDataViewMemory0.buffer.detached === true || (cachedDataViewMemory0.buffer.detached === undefined && cachedDataViewMemory0.buffer !== wasm.memory.buffer)) {
        cachedDataViewMemory0 = new DataView(wasm.memory.buffer);
    }
    return cachedDataViewMemory0;
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

let cachedFloat64ArrayMemory0 = null;
function getFloat64ArrayMemory0() {
    if (cachedFloat64ArrayMemory0 === null || cachedFloat64ArrayMemory0.byteLength === 0) {
        cachedFloat64ArrayMemory0 = new Float64Array(wasm.memory.buffer);
    }
    return cachedFloat64ArrayMemory0;
}

let cachedInt32ArrayMemory0 = null;
function getInt32ArrayMemory0() {
    if (cachedInt32ArrayMemory0 === null || cachedInt32ArrayMemory0.byteLength === 0) {
        cachedInt32ArrayMemory0 = new Int32Array(wasm.memory.buffer);
    }
    return cachedInt32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    return decodeText(ptr >>> 0, len);
}

let cachedUint32ArrayMemory0 = null;
function getUint32ArrayMemory0() {
    if (cachedUint32ArrayMemory0 === null || cachedUint32ArrayMemory0.byteLength === 0) {
        cachedUint32ArrayMemory0 = new Uint32Array(wasm.memory.buffer);
    }
    return cachedUint32ArrayMemory0;
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getObject(idx) { return heap[idx]; }

function handleError(f, args) {
    try {
        return f.apply(this, args);
    } catch (e) {
        wasm.__wbindgen_export3(addHeapObject(e));
    }
}

let heap = new Array(1024).fill(undefined);
heap.push(undefined, null, true, false);

let heap_next = heap.length;

function isLikeNone(x) {
    return x === undefined || x === null;
}

function makeMutClosure(arg0, arg1, f) {
    const state = { a: arg0, b: arg1, cnt: 1 };
    const real = (...args) => {

        // First up with a closure we increment the internal reference
        // count. This ensures that the Rust closure environment won't
        // be deallocated while we're invoking it.
        state.cnt++;
        const a = state.a;
        state.a = 0;
        try {
            return f(a, state.b, ...args);
        } finally {
            state.a = a;
            real._wbg_cb_unref();
        }
    };
    real._wbg_cb_unref = () => {
        if (--state.cnt === 0) {
            wasm.__wbindgen_export4(state.a, state.b);
            state.a = 0;
            CLOSURE_DTORS.unregister(state);
        }
    };
    CLOSURE_DTORS.register(real, state, state);
    return real;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF64ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 8, 8) >>> 0;
    getFloat64ArrayMemory0().set(arg, ptr / 8);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passStringToWasm0(arg, malloc, realloc) {
    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }
    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}

function takeObject(idx) {
    const ret = getObject(idx);
    dropObject(idx);
    return ret;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(ptr, len) {
    numBytesDecoded += len;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: true });
        cachedTextDecoder.decode();
        numBytesDecoded = len;
    }
    return cachedTextDecoder.decode(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    };
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedDataViewMemory0 = null;
    cachedFloat32ArrayMemory0 = null;
    cachedFloat64ArrayMemory0 = null;
    cachedInt32ArrayMemory0 = null;
    cachedUint32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;


    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('cesium_rs_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
