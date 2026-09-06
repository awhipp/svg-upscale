# Specification: Browser-Based 1:1 Color-Accurate Vector Conversion Engine

## 1. System Overview and Objective

The system is a static, client-side React single-page application hosted on GitHub Pages. It ingests raster images and generates scalable vector graphics (SVG) with absolute spatial and color parity ($\Delta E = 0$), completely eliminating tracing distortion, contour dropouts, and operating-system color space shifts.

## 2. Cross-Platform Parity Strategy

Standard browser canvas rendering pipelines (`CanvasRenderingContext2D.drawImage`) inherently fail cross-platform 1:1 color reproduction due to host OS gamma mapping, display gamut conversions (such as sRGB to Display P3 on macOS), and mandatory alpha premultiplication.

| Failure Domain | Mechanism in Standard Canvas | Mitigation Architecture |
| :--- | :--- | :--- |
| **OS Gamut Shift** | Browser converts sRGB to display profile during GPU blit. | Direct binary decoding of raw PNG datastreams via pure JavaScript, completely bypassing host graphics drivers. |
| **Alpha Distortion** | Hardware blitters premultiply alpha, corrupting discrete RGB values. | Raw byte array extraction preserving discrete 8-bit RGBA channels. Fallback decoding enforces unmanaged color spaces. |
| **Seam Artifacts** | Vector rasterizers anti-alias adjacent polygon borders. | SVG root configuration with `shape-rendering="crispEdges"` combined with horizontal and vertical 2D pixel merging. |
| **Host Dependency** | Tracing engines rely on native C or Python binaries. | Pure client-side execution using web standards, executing either on the main thread or Web Workers. |

## 3. Functional Requirements

* **FR-1: File Ingestion & Format Support**
  * Support drag-and-drop and standard file-input ingestion for PNG, WebP, JPEG, and BMP images up to 25 MB and 8192×8192 px.
  * Direct binary PNG decoding (`fast-png`) for uncompromised native 1:1 fidelity.
  * Unmanaged bitmap extraction pipeline (`createImageBitmap` with color conversion and alpha premultiplication explicitly disabled) for secondary formats.
  * Client-side inspection rejecting non-image payloads prior to execution.

* **FR-2: Lossless Vector Transformation**
  * Map visible pixel coordinates directly to vector space with zero spline fitting, zero smoothing, and zero lossy quantization.
  * Generate SVG `viewBox` and `width`/`height` coordinates exactly matching input raster dimensions.
  * Translate raw 8-bit color channels into standard hexadecimal RGB definitions (`#RRGGBB`) with direct alpha mapping via `fill-opacity` (omitted when alpha is 255 / 100% opaque).

* **FR-3: Run-Length Compression & 2D Greedy Meshing**
  * **1D Horizontal Run Compression**: Aggregate contiguous horizontal pixels sharing identical RGBA values into consolidated vector spans.
  * **2D Greedy Meshing**: Consolidate vertically and horizontally adjacent identical pixels into multi-height rectangles, preventing 1-pixel scanline fragmentation and reducing element counts.
  * **Color-Grouped `<path>` Markup**: Consolidate subpaths of identical color into shared SVG `<path>` elements, cutting XML markup size by 50–90% without compromising fidelity.
  * Discard fully transparent pixels ($A = 0$) from the vector output to eliminate DOM overhead.

* **FR-4: Quality Pre-Scaler, Presentation & Export**
  * **Resolution & Quality Pre-Scaler**: Offer curated presets for Digital/Web (Standard HD 1280px, Ultra 2K 2048px, Compact Web 800px), Print/Display (Letter 8.5"×11" @ 300 DPI, Banner / Table Cover 3840px, Conference Backdrop 6144px), and Native 1:1, paired with Smooth (Bilinear) and Crisp (Nearest-Neighbor) resampling filters.
  * **Interactive Preview**: Provide pan and zoom capabilities (up to 32×) and an interactive split-screen comparison slider between source raster and vector output.
  * **High-Performance 60 FPS Viewport**: Isolate rendering via Blob URLs and OffscreenCanvas preview textures for large vectors (>2MB) to prevent browser UI thread stalls.
  * **Universal Export**: Export valid standalone `.svg` files fully compatible with Adobe Illustrator, Figma, Affinity Designer, and Inkscape.

## 4. Technical Requirements

* **TR-1: Application Architecture**
  * Framework: React 19 with TypeScript.
  * Build Tool: Vite configured with relative base paths (`base: './'`) for static hosting in GitHub Pages project subdirectories.
  * Runtime Environment: Pure browser execution with zero external server dependencies, APIs, or proxy services.

* **TR-2: Processing Engine**
  * Dedicated PNG binary decoder extracting raw uncompressed `IDAT` chunks directly into typed 8-bit arrays, bypassing canvas and host GPU gamut conversion.
  * Secondary processing via offscreen rendering buffers with color space conversion and alpha premultiplication explicitly disabled (`colorSpaceConversion: 'none'`, `premultiplyAlpha: 'none'`).
  * Thread isolation: File processing operations execute inside a background Web Worker using Transferable `ArrayBuffer` objects to maintain 60 FPS UI responsiveness.

* **TR-3: Memory and Scalability Limits**
  * Maximum supported input dimension: 8192 by 8192 pixels.
  * Maximum total area limit: 25,000,000 pixels (25 Megapixels).
  * Maximum file size ceiling: 25 Megabytes.
  * Processing latency target: Under 250 milliseconds for images up to 512 by 512 pixels.

## 5. Quality Assurance and Testing Specification

Automated tests must pass in headless continuous integration pipelines prior to artifact generation:

* **Test Suite 1: Color Parity Verification**: Construct synthetic pixel arrays containing full-gamut limits (black, white, primaries, semi-transparent alpha variants) asserting bit-for-bit lossless output ($\Delta E = 0$).
* **Test Suite 2: Spatial and Geometry Bounds**: Ingest non-square test fixtures asserting that root dimensions, viewBox, and boundary pixels match input coordinates exactly.
* **Test Suite 3: Run-Length Compression Efficiency**: Assert that runs of $N$ identical pixels compress into single vector entities and transparent regions generate zero vector nodes.
* **Test Suite 4: Integration & Benchmark Protocol**: Validate end-to-end encoding/decoding, dimension enforcement, and TR-3 benchmark latency (<250ms for 512×512px).
* **Test Suite 5: Vectorization Optimizations**: Verify 2D greedy meshing, color-grouped `<path>` markup generation, and quality pre-scaler presets.

## 6. GitHub Pages Deployment Specification

* **DP-1: Pipeline Architecture**: GitHub Actions automated workflow triggered on pushes to `main`, enforcing dependency installation (`npm ci`), static typechecking (`npm run typecheck`), automated test execution (`npm run test`), and static compilation (`npm run build`).
* **DP-2: Static Hosting**: Static compilation output emits relative asset references deployed directly to the GitHub Pages environment without post-build server processing.
