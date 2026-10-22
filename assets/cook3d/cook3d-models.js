/* Crisp Kitchen 3D — مكتبة النمذجة الإجرائية الكرتونية
 * كل قطعة أكل وأداة تُبنى هندسياً في المتصفح — لا ملفات GLB ولا تحميلات.
 * الأسلوب: MeshToonMaterial بتدرّج 3 درجات + ألوان مشبعة + نسب ممتلئة.
 *
 * الترتيب المطلوب: three.min.js → roundedbox.js → orbit.js → هذا الملف → cook3d.js
 * الواجهة العامة: CC3D_MODELS.init(isWebGL2) ثم CC3D_MODELS.foods / props / airfryer / env
 */
(function (global) {
  'use strict';
  var THREE = global.THREE;
  if (!THREE) throw new Error('CC3D models: THREE is missing');

  /* ── التدرج الثلاثي لكل المواد الكرتونية ── */
  var gradTex = null;
  function init(isWebGL2) {
    var steps = new Uint8Array([70, 160, 255]);
    var fmt = isWebGL2 ? THREE.RedFormat : THREE.LuminanceFormat;
    gradTex = new THREE.DataTexture(steps, steps.length, 1, fmt);
    gradTex.minFilter = THREE.NearestFilter;
    gradTex.magFilter = THREE.NearestFilter;
    gradTex.generateMipmaps = false;
    gradTex.needsUpdate = true;
  }

  /* ── مساعدات بناء ── */
  function toon(hex, opts) {
    opts = opts || {};
    opts.color = hex;
    opts.gradientMap = gradTex;
    return new THREE.MeshToonMaterial(opts);
  }
  function M(geo, mat, px, py, pz, rx, ry, rz, sx, sy, sz) {
    var m = new THREE.Mesh(geo, mat);
    if (px !== undefined) m.position.set(px, py, pz);
    if (rx !== undefined) m.rotation.set(rx || 0, ry || 0, rz || 0);
    if (sx !== undefined) m.scale.set(sx, sy === undefined ? sx : sy, sz === undefined ? sx : sz);
    m.castShadow = false; m.receiveShadow = false;
    return m;
  }
  function G(children, px, py, pz) {
    var g = new THREE.Group();
    (children || []).forEach(function (c) { g.add(c); });
    if (px !== undefined) g.position.set(px, py, pz);
    return g;
  }
  function sphere(r, mat, seg) { return new THREE.SphereGeometry(r, seg || 18, seg ? Math.max(8, (seg / 2) | 0) : 12); }
  function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
  function rbox(w, h, d, r, seg) { return new THREE.RoundedBoxGeometry(w, h, d, seg || 3, r); }
  function cyl(rt, rb, h, mat, seg) { return new THREE.CylinderGeometry(rt, rb, h, seg || 18); }
  function capsule(r, len, mat, seg) {
    /* كبسولة يدوية (r128 بلا CapsuleGeometry): أسطوانة + نصفا كرة */
    var g = G([
      M(cyl(r, r, len, mat, seg || 14), mat, 0, 0, 0),
      M(sphere(r, mat, seg || 14), mat, 0, len / 2, 0),
      M(sphere(r, mat, seg || 14), mat, 0, -len / 2, 0)
    ]);
    return g;
  }
  function torus(r, t, arc, mat) {
    var geo = new THREE.TorusGeometry(r, t, 12, 24, arc || Math.PI * 2);
    return geo;
  }
  function lathe(points, mat, seg) {
    return new THREE.LatheGeometry(points.map(function (p) { return new THREE.Vector2(p[0], p[1]); }), seg || 28);
  }

  /* ── نظام النضج: لكل مادة لون خام ولون مطبوخ ── */
  function markRaw(mesh, raw, cooked) {
    var list = mesh.userData.doneness || (mesh.userData.doneness = []);
    list.push({ mat: mesh.material, raw: new THREE.Color(raw), cooked: new THREE.Color(cooked) });
    mesh.material.color.copy(list[0].raw);
    return mesh;
  }
  function applyDoneness(root, t) {
    root.traverse(function (o) {
      var d = o.userData && o.userData.doneness;
      if (d) for (var i = 0; i < d.length; i++) d[i].mat.color.copy(d[i].raw).lerp(d[i].cooked, t);
    });
  }

  /* ── لوحة الألوان الكرتونية المشتركة ── */
  var C = {
    cream: 0xf5e7cf, terracotta: 0xb45a16, terracottaDeep: 0x8f430f,
    wood: 0xc99a5e, woodDark: 0xa87a44, dark: 0x3a3430, darkSoft: 0x55483a,
    white: 0xfff6ea, metal: 0x8f959e,
    breadRaw: 0xeccf96, breadCook: 0xc07f33,
    chickenRaw: 0xf0b9a0, chickenCook: 0xb2612a,
    beefRaw: 0xc4513f, beefCook: 0x7a3a22,
    porkRaw: 0xf0a892, porkCook: 0xa85c30,
    fishRaw: 0xff8f7a, fishCook: 0xdd8a63,
    cheese: 0xf7c34c, sauce: 0xc0392b, green: 0x6fae4a, greenDark: 0x4e7c33,
    potatoRaw: 0xe8d3a4, potatoCook: 0xc99a4e,
    eggshell: 0xfdf3e0, yolk: 0xf2b53c
  };

  /* ═══════════════ قواطع الأطعمة (كل واحدة تُرجع Group بلاطة قاعدتها y=0) ═══════════════ */

  var F = {}; // FOODS

  /* دجاجة/أجنحة: قطعة كبسولة مع عظم صغير */
  function wingPiece(i) {
    var mat = toon(C.chickenRaw);
    var skinRaw = 0xf3c9a4, skinCook = 0x8a4a1e;
    var skin = toon(skinRaw);
    var g = G([
      markRaw(M(sphere(0.30, mat), mat, 0, 0.26, 0, 0, 0, 0.4, 1.0, 0.82), C.chickenRaw, C.chickenCook),
      markRaw(M(sphere(0.17, skin), skin, 0.16, 0.30, -0.14, 0, 0, 0, 1, 0.8, 1), skinRaw, skinCook),
      M(cyl(0.045, 0.05, 0.22, toon(0xf5ead2), 10), toon(0xf5ead2), -0.30, 0.16, 0.06, 0, 0, Math.PI / 2.4)
    ]);
    g.rotation.y = i * 1.7;
    return g;
  }
  F.wings = { build: wingPiece, size: 0.62 };

  /* ساتاي: سيخ مع 3 مكعبات دجاج */
  F.satay = { size: 0.9, build: function (i) {
    var stick = M(cyl(0.03, 0.03, 1.15, toon(0xd9b98a), 8), toon(0xd9b98a), 0, 0.55, 0, 0, 0, 0.12);
    var parts = [stick];
    for (var k = 0; k < 3; k++) {
      var mat = toon(C.chickenRaw);
      parts.push(markRaw(M(rbox(0.3, 0.26, 0.26, 0.09, 2), mat, (k - 1) * 0.34, 0.62 + (k % 2) * 0.1, 0, 0, i, k * 0.7), C.chickenRaw, C.chickenCook));
    }
    var g = G(parts);
    g.rotation.z = Math.PI / 2.15; g.position.y = 0.1; g.rotation.y = i * 1.3;
    var w = G([g]); w.position.y = 0.45; return w;
  } };

  /* أصابع دجاج مقرمشة */
  F.tenders = { size: 0.75, build: function (i) {
    var mat = toon(C.breadRaw);
    var g = G([markRaw(M(rbox(0.34, 0.85, 0.3, 0.13, 3), mat, 0, 0.42, 0, 0, 0, i * 0.15 - 0.07), C.breadRaw, C.breadCook)]);
    g.rotation.y = i * 1.9; return g;
  } };

  /* ناغتس: كتلة مُقرمشة ممتلئة */
  F.nuggets = { size: 0.5, build: function (i) {
    var mat = toon(C.breadRaw);
    var g = G([markRaw(M(sphere(0.28, mat, 14), mat, 0, 0.24, 0, 0, i, 0, 1.25, 0.75, 1.05), C.breadRaw, C.breadCook)]);
    g.rotation.y = i * 2.1; return g;
  } };

  /* بارميزان: قطيلة + صلصة + جبن */
  F.parm = { size: 1.0, build: function () {
    var chicken = toon(C.chickenRaw), sauce = toon(C.sauce), cheese = toon(C.cheese);
    return G([
      markRaw(M(rbox(0.95, 0.16, 0.7, 0.07, 2), chicken, 0, 0.08, 0), C.chickenRaw, C.chickenCook),
      M(rbox(0.82, 0.07, 0.6, 0.03, 2), sauce, 0, 0.19, 0),
      M(rbox(0.7, 0.09, 0.5, 0.03, 2), cheese, 0, 0.26, 0),
      M(sphere(0.05, toon(C.green), 8), toon(C.green), 0.18, 0.33, 0.08),
      M(sphere(0.04, toon(C.green), 8), toon(C.green), -0.15, 0.32, -0.06)
    ]);
  } };

  /* دجاجة كاملة: جسم + أفخاذ + جناحان */
  F.wholebird = { size: 1.6, build: function () {
    var mat = toon(C.chickenRaw), skin = toon(0xf3c9a4);
    var body = G([
      markRaw(M(sphere(0.62, mat, 20), mat, 0, 0.6, 0, 0, 0, 0, 1, 0.82, 1.15), C.chickenRaw, 0x9c5322),
      markRaw(M(sphere(0.28, skin), skin, 0.5, 0.35, 0.42, 0.5, 0, 0.4, 1, 0.8, 1), 0xf3c9a4, 0x8a4a1e),
      markRaw(M(sphere(0.28, skin), skin, 0.5, 0.35, -0.42, -0.5, 0, 0.4, 1, 0.8, 1), 0xf3c9a4, 0x8a4a1e),
      M(sphere(0.24, skin), skin, -0.58, 0.55, 0.18, 0, 0, -0.5),
      M(sphere(0.24, skin), skin, -0.58, 0.55, -0.18, 0, 0, -0.5)
    ]);
    return body;
  } };

  /* مشوي/تحميص: رغيف لحم مع خطوط شواء */
  F.roast = { size: 1.5, build: function () {
    var mat = toon(C.beefRaw);
    var g = G([markRaw(M(rbox(1.05, 0.62, 0.72, 0.22, 3), mat, 0, 0.34, 0), C.beefRaw, C.beefCook)]);
    for (var k = -1; k <= 1; k++)
      g.add(M(box(0.03, 0.02, 0.6), toon(0x5d2c18), k * 0.3, 0.66, 0));
    return g;
  } };

  /* برغر: قرص لحم + جبن يذوب */
  F.burger = { size: 0.9, build: function (i) {
    var mat = toon(C.beefRaw);
    var g = G([
      markRaw(M(cyl(0.42, 0.44, 0.2, mat, 20), mat, 0, 0.1, 0), C.beefRaw, 0x6e3420),
      M(cyl(0.45, 0.44, 0.05, toon(C.cheese), 20), toon(C.cheese), 0, 0.22, 0, 0, i * 0.4, 0)
    ]);
    g.rotation.y = i * 0.8; return g;
  } };

  /* كرات لحم */
  F.meatballs = { size: 0.5, build: function (i) {
    var mat = toon(C.beefRaw);
    var g = G([markRaw(M(sphere(0.26, mat, 14), mat, 0, 0.25, 0, 0, i, 0, 1, 0.95, 1), C.beefRaw, 0x6e3a1e)]);
    return g;
  } };

  /* ميتلوف */
  F.meatloaf = { size: 1.3, build: function () {
    var mat = toon(0xb96a4a);
    var g = G([markRaw(M(rbox(1.0, 0.45, 0.55, 0.16, 3), mat, 0, 0.25, 0), 0xb96a4a, 0x7c4526)]);
    g.add(M(box(0.9, 0.03, 0.2), toon(0x9c4a2a), 0, 0.49, 0));
    g.add(M(box(0.9, 0.03, 0.2), toon(0x9c4a2a), 0, 0.49, -0.18));
    return g;
  } };

  /* أقراص سمك/سلمن */
  F.patties = { size: 0.75, build: function (i) {
    var mat = toon(0xf2b39a);
    var g = G([markRaw(M(cyl(0.36, 0.38, 0.14, mat, 18), mat, 0, 0.07, 0), 0xf2b39a, 0xc9762e)]);
    g.rotation.y = i; return g;
  } };

  /* فيليه سمك/سلمن مع خطوط تفتيت */
  F.salmon = { size: 1.25, build: function (i) {
    var mat = toon(C.fishRaw);
    var g = G([
      markRaw(M(rbox(1.1, 0.22, 0.62, 0.1, 3), mat, 0, 0.13, 0), C.fishRaw, C.fishCook),
      M(box(1.06, 0.235, 0.045), toon(0xffe3da), 0, 0.135, -0.16),
      M(box(1.06, 0.235, 0.045), toon(0xffe3da), 0, 0.135, 0.02),
      M(box(1.06, 0.235, 0.045), toon(0xffe3da), 0, 0.135, 0.2)
    ]);
    g.rotation.y = i * 0.5; return g;
  } };

  /* روبيان: هلال مع ذيل */
  F.shrimp = { size: 0.55, build: function (i) {
    function cone(r, h, s) { return new THREE.ConeGeometry(r, h, s); }
    var mat = toon(0xffa98c);
    var body = M(torus(0.17, 0.085, Math.PI * 1.35, mat), mat, 0, 0.19, 0, Math.PI / 2, 0, 0);
    markRaw(body, 0xffa98c, 0xf0743f);
    var tail = M(cone(0.09, 0.2, 8), toon(0xf66a53), 0.19, 0.2, 0.05, 0.6, 0, -0.5);
    var g = G([body, tail]);
    g.rotation.y = i * 1.4; return g;
  } };

  /* ستيك: شرائح مع خطوط شواء وطبقة دهن */
  F.steak = { size: 1.2, build: function (i) {
    var mat = toon(C.beefRaw);
    var g = G([
      markRaw(M(rbox(1.0, 0.26, 0.68, 0.1, 3), mat, 0, 0.15, 0), C.beefRaw, C.beefCook),
      M(rbox(1.0, 0.05, 0.14, 0.02, 2), toon(0xf0c9a2), 0, 0.15, 0.30)
    ]);
    for (var k = -1; k <= 1; k++) g.add(M(box(0.035, 0.02, 0.55), toon(0x4e2a16), k * 0.28, 0.29, 0));
    g.rotation.y = i * 0.35; return g;
  } };

  /* تشوبس: قطعة مع عظم بارز */
  F.chops = { size: 1.0, build: function (i) {
    var mat = toon(C.porkRaw);
    var g = G([
      markRaw(M(rbox(0.72, 0.24, 0.55, 0.09, 3), mat, -0.08, 0.14, 0), C.porkRaw, C.porkCook),
      M(cyl(0.05, 0.055, 0.5, toon(0xf3e6cd), 10), toon(0xf3e6cd), 0.44, 0.12, 0, 0, 0, Math.PI / 2),
      M(sphere(0.075, toon(0xf3e6cd), 10), toon(0xf3e6cd), 0.68, 0.12, 0)
    ]);
    g.rotation.y = i * 0.9; return g;
  } };

  /* أضلاع: لوح مع صف عظام منحني */
  F.ribs = { size: 1.35, build: function (i) {
    var mat = toon(C.porkRaw);
    var g = G([markRaw(M(rbox(1.15, 0.2, 0.6, 0.08, 3), mat, 0, 0.12, 0), C.porkRaw, C.porkCook)]);
    for (var k = 0; k < 4; k++) {
      var b = M(cyl(0.032, 0.032, 0.62, toon(0xf3e6cd), 8), toon(0xf3e6cd), -0.45 + k * 0.3, 0.1, 0, Math.PI / 2.25, 0, k * 0.06 - 0.09);
      g.add(b);
    }
    g.rotation.y = i * 0.5; return g;
  } };

  /* نقانق */
  F.sausages = { size: 0.8, build: function (i) {
    var mat = toon(0xd98a70);
    var g = G([markRaw(M(capsule(0.13, 0.5, mat, 12), mat, 0, 0.14, 0, 0, 0, Math.PI / 2.6), 0xd98a70, 0x9c4f26)]);
    g.rotation.y = i * 1.2; return g;
  } };

  /* كورن دوغ: نقانق بالعجين على سيخ */
  F['corn dogs'] = { size: 0.9, build: function (i) {
    var batter = toon(C.breadRaw);
    var g = G([
      M(cyl(0.028, 0.028, 0.85, toon(0xd9b98a), 8), toon(0xd9b98a), 0, 0.42, 0),
      markRaw(M(capsule(0.145, 0.4, batter, 12), batter, 0, 0.62, 0), C.breadRaw, C.breadCook)
    ]);
    g.rotation.z = 0.12; g.rotation.y = i * 1.1; return g;
  } };

  /* لحم مقدد: شرائح متعرجة */
  F.bacon = { size: 1.0, build: function (i) {
    var mat = toon(0xe89a8a);
    var g = new THREE.Group();
    var segs = 6;
    for (var k = 0; k < segs; k++) {
      var seg = M(box(0.16, 0.035, 0.3), mat, 0, 0.1 + Math.sin(k / (segs - 1) * Math.PI) * 0.16, (k / (segs - 1) - 0.5) * 0.78, 0, 0, (k % 2 ? 0.35 : -0.35));
      markRaw(seg, 0xe89a8a, 0x9c4326);
      g.add(seg);
    }
    g.rotation.y = i * 1.3; return g;
  } };

  /* أصابع جبن مقلية */
  F.sticks = { size: 0.8, build: function (i) {
    var mat = toon(C.breadRaw);
    var g = G([
      markRaw(M(capsule(0.09, 0.55, mat, 12), mat, 0, 0.33, 0), C.breadRaw, C.breadCook),
      M(cyl(0.055, 0.055, 0.08, toon(C.cheese), 10), toon(C.cheese), 0, 0.62, 0)
    ]);
    g.rotation.z = (i % 2 ? 1 : -1) * 0.1; g.rotation.y = i * 1.6; return g;
  } };

  /* ساندويتش محمص */
  F.sandwich = { size: 1.0, build: function (i) {
    var bread = toon(0xe8c58f);
    var g = G([
      markRaw(M(rbox(0.85, 0.09, 0.75, 0.05, 2), bread, 0, 0.14, 0), 0xe8c58f, 0xc08b43),
      M(rbox(0.8, 0.05, 0.68, 0.03, 2), toon(C.cheese), 0, 0.21, 0),
      markRaw(M(rbox(0.85, 0.09, 0.75, 0.05, 2), bread, 0, 0.29, 0, 0, i * 0.2, 0), 0xe8c58f, 0xc08b43)
    ]);
    return g;
  } };

  /* شريحة بيتزا */
  F.pizza = { size: 1.1, build: function (i) {
    var crust = toon(0xd9a054);
    var slice = new THREE.Group();
    var base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.07, 14, 1, false, 0, Math.PI / 3), crust);
    base.position.y = 0.06; slice.add(base);
    var sauce = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.02, 14, 1, false, 0.05, Math.PI / 3 - 0.1), toon(C.sauce));
    sauce.position.y = 0.1; slice.add(sauce);
    var cheese = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.48, 0.03, 14, 1, false, 0.06, Math.PI / 3 - 0.12), toon(0xf7cf6a));
    cheese.position.y = 0.125; slice.add(cheese);
    for (var k = 0; k < 3; k++) {
      var pep = M(cyl(0.07, 0.07, 0.02, toon(0xb3402a), 12), toon(0xb3402a),
        Math.cos(0.35 + k * 0.75) * 0.3, 0.15, Math.sin(0.35 + k * 0.75) * 0.3);
      slice.add(pep);
    }
    slice.rotation.y = i * 1.2; return slice;
  } };

  /* بطاطس مقلية: أصابع ذهبية */
  F.fries = { size: 0.55, build: function (i) {
    var mat = toon(C.potatoRaw);
    var g = G([markRaw(M(rbox(0.12, 0.5, 0.12, 0.05, 2), mat, 0, 0.25, 0, (i % 3 - 1) * 0.12, i * 1.1, (i % 2 ? 0.12 : -0.1)), C.potatoRaw, 0xd69738)]);
    return g;
  } };

  /* بطاطس مشوية كاملة */
  F['baked potato'] = { size: 1.15, build: function (i) {
    var mat = toon(0xc9a05e);
    var g = G([markRaw(M(sphere(0.34, mat, 16), mat, 0, 0.3, 0, 0, i, 0, 1.5, 0.8, 1), 0xc9a05e, 0x9c6a2a)]);
    g.add(M(box(0.45, 0.03, 0.16), toon(0xf7e9b0), 0, 0.44, 0, 0, 0, 0.3)); // زبدة
    return g;
  } };

  /* قشور بطاطس محشوة */
  F['potato skins'] = { size: 0.7, build: function (i) {
    var mat = toon(0xb98a4a);
    var g = G([markRaw(M(sphere(0.3, mat, 14), mat, 0, 0.22, 0, 0, i, 0, 1.1, 0.7, 1), 0xb98a4a, 0x8a5a22)]);
    g.add(M(box(0.4, 0.05, 0.22), toon(C.cheese), 0, 0.36, 0));
    g.add(M(box(0.16, 0.05, 0.1), toon(0xc4513f), 0.08, 0.4, 0.02));
    return g;
  } };

  /* مكعبات بطاطس */
  F['potato cubes'] = { size: 0.45, build: function (i) {
    var mat = toon(C.potatoRaw);
    var g = G([markRaw(M(rbox(0.3, 0.26, 0.3, 0.07, 2), mat, 0, 0.15, 0, 0, i, 0), C.potatoRaw, 0xcf9440)]);
    return g;
  } };

  /* كوز ذرة */
  F.corn = { size: 1.05, build: function (i) {
    var mat = toon(0xf2ce56);
    var g = G([
      markRaw(M(cyl(0.13, 0.1, 0.62, mat, 14), mat, 0, 0.34, 0, 0, 0, Math.PI / 2.1), 0xf2ce56, 0xd69a2e),
      M(sphere(0.09, toon(C.greenDark), 10), toon(C.greenDark), 0.28, 0.28, 0, 0.3, 0, -0.4),
      M(sphere(0.08, toon(C.green), 10), toon(C.green), 0.3, 0.3, -0.1, 0, 0, -0.2)
    ]);
    g.rotation.y = i * 1.5; return g;
  } };

  /* حلقات بصل */
  F.rings = { size: 0.6, build: function (i) {
    var mat = toon(C.breadRaw);
    var g = G([markRaw(M(torus(0.2, 0.07, Math.PI * 2, mat), mat, 0, 0.14, 0, Math.PI / 2, 0, 0), C.breadRaw, C.breadCook)]);
    return g;
  } };

  /* لفائف: إيرولز/سمبوسة/إمبانادا */
  F.rolls = { size: 0.85, build: function (i) {
    var mat = toon(0xe0b070);
    var g = G([markRaw(M(capsule(0.15, 0.45, mat, 12), mat, 0, 0.17, 0, 0, 0, Math.PI / 2.3), 0xe0b070, 0xb97430)]);
    g.rotation.y = i * 1.4; return g;
  } };

  /* فلفل محشي بالجبن */
  F.poppers = { size: 0.55, build: function (i) {
    function coneG(r, h, s) { return new THREE.ConeGeometry(r, h, s); }
    var mat = toon(C.green);
    var g = G([
      markRaw(M(coneG(0.13, 0.4, 10), mat, 0, 0.2, 0, Math.PI, 0, 0), C.green, 0x4e7c33),
      M(sphere(0.1, toon(C.breadRaw), 10), toon(C.breadRaw), 0, 0.42, 0)
    ]);
    g.rotation.y = i; return g;
  } };

  /* تشكيلة ضيوف: ناغتس + أصبع + جناح بالتناوب */
  F['party mix'] = { size: 0.6, build: function (i) {
    var pick = i % 3;
    var src = pick === 0 ? F.nuggets : pick === 1 ? F.sticks : F.wings;
    var g = src.build(i + 7);
    return g;
  } };

  /* مشروم */
  F.mushrooms = { size: 0.5, build: function (i) {
    var cap = toon(0xe8d9c2), stem = toon(0xf3ead8);
    var g = G([
      markRaw(M(sphere(0.2, cap, 14), cap, 0, 0.3, 0, 0, 0, 0, 1, 0.62, 1), 0xe8d9c2, 0xb07b45),
      M(cyl(0.07, 0.09, 0.22, stem, 10), stem, 0, 0.11, 0)
    ]);
    g.rotation.y = i; return g;
  } };

  /* كرنب بروكسل */
  F.brussels = { size: 0.45, build: function (i) {
    var outer = toon(C.green), inner = toon(0xd8e3a8);
    var g = G([
      M(sphere(0.2, outer, 12), outer, 0, 0.2, 0),
      markRaw(M(sphere(0.13, inner, 12), inner, 0, 0.26, 0), 0xd8e3a8, 0xc9b060)
    ]);
    return g;
  } };

  /* زهرات بروكلي/قرنبيط */
  F.florets = { size: 0.55, build: function (i) {
    var stem = toon(0xb8d178), head = toon(0x7cae4e);
    var g = G([M(cyl(0.05, 0.07, 0.2, stem, 8), stem, 0, 0.1, 0)]);
    for (var k = 0; k < 5; k++) {
      var bump = M(sphere(0.09, head, 8), head,
        Math.cos(k * 1.26) * 0.09, 0.26 + (k % 2) * 0.05, Math.sin(k * 1.26) * 0.09);
      if (k === 0) markRaw(bump, 0x7cae4e, 0x8a7a35); else markRaw(bump, 0x7cae4e, 0x8a7a35);
      g.add(bump);
    }
    g.rotation.y = i * 1.1; return g;
  } };

  /* هليون */
  F.asparagus = { size: 0.95, build: function (i) {
    function coneG(r, h, s) { return new THREE.ConeGeometry(r, h, s); }
    var mat = toon(C.green);
    var g = G([
      markRaw(M(cyl(0.035, 0.045, 0.75, mat, 8), mat, 0, 0.37, 0, 0, 0, (i % 3 - 1) * 0.18), C.green, 0x6d8a3a),
      M(coneG(0.05, 0.14, 8), toon(C.greenDark), 0, 0.78, 0)
    ]);
    return g;
  } };

  /* شرائح ملفوف */
  F['cabbage steaks'] = { size: 1.0, build: function (i) {
    var mat = toon(0xcfe0a0);
    var g = G([
      markRaw(M(cyl(0.42, 0.46, 0.16, mat, 18), mat, 0, 0.1, 0), 0xcfe0a0, 0xc0a35c),
      M(cyl(0.09, 0.11, 0.18, toon(0xf3f0d2), 10), toon(0xf3f0d2), 0, 0.11, 0)
    ]);
    return g;
  } };

  /* خضار مشكلة: شرائح فلفل وكوسا وجزر */
  F['veggie mix'] = { size: 0.5, build: function (i) {
    var pick = i % 3;
    var mat = toon(pick === 0 ? 0xe07b3c : pick === 1 ? C.green : 0xf2a13c);
    var g;
    if (pick === 0) {
      g = G([markRaw(M(box(0.3, 0.04, 0.14), mat, 0, 0.04, 0, 0, i, 0.3), mat, 0xe07b3c, 0xb05a24)]);
    } else if (pick === 1) {
      g = G([markRaw(M(cyl(0.14, 0.14, 0.05, mat, 14), mat, 0, 0.03, 0), mat, C.green, 0x6d8a3a)]);
    } else {
      g = G([markRaw(M(cyl(0.1, 0.1, 0.05, mat, 12), mat, 0, 0.03, 0), mat, 0xf2a13c, 0xd67f22)]);
    }
    return g;
  } };

  /* مكعبات توفو */
  F.tofu = { size: 0.45, build: function (i) {
    var mat = toon(0xf3e9c8);
    var g = G([markRaw(M(rbox(0.3, 0.24, 0.3, 0.04, 2), mat, 0, 0.13, 0, 0, i * 0.7, 0), 0xf3e9c8, 0xd9a94e)]);
    return g;
  } };

  /* بيض */
  F.eggs = { size: 0.45, build: function (i) {
    var mat = toon(C.eggshell);
    var g = G([markRaw(M(sphere(0.17, mat, 14), mat, 0, 0.19, 0, 0, 0, 0, 1, 1.3, 1), C.eggshell, 0xe8c990)]);
    return g;
  } };

  /* رقائق تفاح */
  F.chips = { size: 0.5, build: function (i) {
    var mat = toon(0xe8c088);
    var g = G([markRaw(M(torus(0.16, 0.035, Math.PI * 2, mat), mat, 0, 0.1, 0, Math.PI / 2.4, i * 0.4, 0), 0xe8c088, 0xc08a4a)]);
    return g;
  } };

  /* كوكيز */
  F.cookies = { size: 0.5, build: function (i) {
    var mat = toon(0xd9a054);
    var g = G([markRaw(M(cyl(0.19, 0.2, 0.07, mat, 14), mat, 0, 0.045, 0), 0xd9a054, 0xa86a30)]);
    for (var k = 0; k < 4; k++)
      g.add(M(sphere(0.028, toon(0x4e2a16), 6), toon(0x4e2a16),
        Math.cos(k * 1.9 + i) * 0.1, 0.09, Math.sin(k * 1.9 + i) * 0.1));
    return g;
  } };

  /* دونات */
  F.donut = { size: 0.6, build: function (i) {
    var dough = toon(0xd9a054), icing = toon(0xe87a9c);
    var g = G([
      markRaw(M(torus(0.2, 0.085, Math.PI * 2, dough), dough, 0, 0.12, 0, Math.PI / 2, 0, 0), 0xd9a054, 0xb97430),
      M(torus(0.2, 0.06, Math.PI * 2, icing), icing, 0, 0.16, 0, Math.PI / 2, 0, 0)
    ]);
    for (var k = 0; k < 6; k++)
      g.add(M(box(0.045, 0.012, 0.012), toon(k % 2 ? 0xfff6ea : 0x6fae4a), Math.cos(k * 1.05) * 0.2, 0.225, Math.sin(k * 1.05) * 0.2, 0, k, 0.4));
    return g;
  } };

  /* قطعة كيك */
  F['cake slice'] = { size: 0.7, build: function () {
    var crumb = toon(0xf0c98a), frost = toon(0xf7e3d0);
    var slice = new THREE.Group();
    var base = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.42, 0.3, 12, 1, false, 0, Math.PI / 3.2), crumb);
    base.position.y = 0.15; slice.add(base);
    var top = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.42, 0.06, 12, 1, false, 0, Math.PI / 3.2), frost);
    top.position.y = 0.33; slice.add(top);
    return slice;
  } };

  /* القطع العامة (fallback) */
  F.morsels = { size: 0.5, build: function (i) {
    var mat = toon(0xe0b070);
    var g = G([markRaw(M(sphere(0.24, mat, 12), mat, 0, 0.22, 0, 0, i, 0, 1.2, 0.8, 1), 0xe0b070, 0xb97430)]);
    g.rotation.y = i * 1.3; return g;
  } };

  /* ═══════════════ الأدوات والعناصر (props) ═══════════════ */

  var P = {}; // PROPS

  /* صحن: مخروط مقلوب ناعم بحافة ملونة */
  P.plate = function (accent) {
    var mat = toon(C.white);
    var rim = toon(accent || C.terracotta);
    var geo = lathe([[0, 0], [0.55, 0.02], [0.95, 0.1], [1.05, 0.18], [1.0, 0.2], [0.9, 0.13], [0.52, 0.06], [0, 0.045]]);
    var g = new THREE.Group();
    g.add(M(geo, mat, 0, 0, 0));
    g.add(M(lathe([[0.9, 0.135], [1.04, 0.185], [0.99, 0.2], [0.9, 0.15], [0.9, 0.135]]), rim, 0, 0.002, 0));
    return g;
  };

  /* زبدية */
  P.bowl = function () {
    var mat = toon(C.white);
    var g = new THREE.Group();
    g.add(M(lathe([[0, 0.01], [0.3, 0.02], [0.5, 0.18], [0.62, 0.4], [0.58, 0.42], [0.47, 0.2], [0.28, 0.05], [0, 0.05]]), mat, 0, 0, 0));
    return g;
  };

  /* ملقط */
  P.tongs = function () {
    var metal = toon(C.metal, { transparent: true, opacity: 0.95 });
    var arm = function (side) {
      return G([
        M(box(0.05, 0.03, 0.9), metal, 0, 0, 0, -0.12 * side, 0, 0),
        M(box(0.055, 0.035, 0.22), metal, 0, 0.13 * side + 0.02, 0.5, -0.5 * side, 0, 0)
      ]);
    };
    return G([arm(1), arm(-1), M(cyl(0.02, 0.02, 0.12, metal, 8), metal, 0, 0, -0.42, Math.PI / 2, 0, 0)]);
  };

  /* ملعقة تقديم */
  P.spoon = function () {
    var wood = toon(C.woodDark);
    return G([
      M(cyl(0.045, 0.05, 0.8, wood, 10), wood, 0, 0.4, 0, 0.25, 0, 0),
      M(sphere(0.14, wood, 12), wood, 0, 0.82, 0.1, 1.2, 0, 0, 1, 0.45, 0.8)
    ]);
  };

  /* سباتولا (ملعقة تقليب) */
  P.spatula = function () {
    var handle = toon(C.terracotta), blade = toon(0x5a616b);
    return G([
      M(box(0.07, 0.55, 0.05), handle, 0, 0.28, 0),
      M(rbox(0.3, 0.035, 0.42, 0.015, 2), blade, 0, 0.62, 0.06, 0.25, 0, 0)
    ]);
  };

  /* ترمومتر بشاشة نصية (CanvasTexture) */
  P.thermometer = function () {
    var body = toon(C.terracotta), dark = toon(0x2e2a26);
    var cv = document.createElement('canvas');
    cv.width = 128; cv.height = 64;
    var ctx = cv.getContext('2d');
    var tex = new THREE.CanvasTexture(cv);
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.17),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    screen.position.set(0, 0.62, 0.101);
    var g = G([
      M(rbox(0.4, 0.55, 0.2, 0.06, 3), body, 0, 0.28, 0),
      M(rbox(0.36, 0.2, 0.02, 0.02, 2), dark, 0, 0.62, 0.09),
      M(cyl(0.022, 0.008, 0.5, toon(0xd0d5da), 8), toon(0xd0d5da), 0, -0.22, 0),
      screen
    ]);
    g.userData.setTemp = function (txt) {
      ctx.clearRect(0, 0, 128, 64);
      ctx.fillStyle = '#2e2a26';
      ctx.fillRect(0, 0, 128, 64);
      ctx.fillStyle = '#ffd76a';
      ctx.font = 'bold 30px Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, 64, 34);
      tex.needsUpdate = true;
    };
    g.userData.setTemp('165°F');
    return g;
  };

  /* بخاخ زيت */
  P.oilSpray = function () {
    var bottle = toon(0xd8c98f), head = toon(0x4e545c);
    return G([
      M(cyl(0.14, 0.16, 0.5, bottle, 14), bottle, 0, 0.25, 0),
      M(cyl(0.08, 0.08, 0.12, head, 12), head, 0, 0.56, 0),
      M(box(0.16, 0.05, 0.06), head, 0.08, 0.56, 0),
      M(cyl(0.05, 0.14, 0.28, toon(0xf2d98a, { transparent: true, opacity: 0.35 }), 12, 1, true),
        toon(0xf2d98a, { transparent: true, opacity: 0.35 }), 0.24, 0.56, 0, 0, 0, -0.9)
    ]);
  };

  /* ملّاحة ملح */
  P.shaker = function () {
    var glass = toon(0xe8e2d2, { transparent: true, opacity: 0.85 }), cap = toon(C.terracotta);
    return G([
      M(cyl(0.13, 0.15, 0.42, glass, 14), glass, 0, 0.21, 0),
      M(cyl(0.14, 0.12, 0.1, cap, 14), cap, 0, 0.47, 0),
      M(sphere(0.075, cap, 10), cap, 0, 0.52, 0)
    ]);
  };

  /* لوح تقطيع */
  P.board = function () {
    var wood = toon(0xd9b072);
    return G([M(rbox(1.3, 0.07, 0.85, 0.05, 2), wood, 0, 0.035, 0),
              M(cyl(0.09, 0.09, 0.075, toon(0x8a6234), 12), toon(0x8a6234), 0.55, 0.038, 0)]);
  };

  /* غارنيش: بقدونس + شريحة ليمون */
  P.garnish = function () {
    var g = new THREE.Group();
    var leaf = toon(C.green);
    for (var k = 0; k < 5; k++)
      g.add(M(sphere(0.05, leaf, 6), leaf, Math.cos(k * 1.25) * 0.07, 0.06 + (k % 2) * 0.05, Math.sin(k * 1.25) * 0.07, 0, k, 0));
    g.add(M(cyl(0.015, 0.015, 0.16, toon(C.greenDark), 6), toon(C.greenDark), 0, 0.08, 0));
    var lemon = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.035, 12, 1, false, 0, Math.PI), toon(0xf7df6a));
    lemon.position.set(0.18, 0.02, 0.05); lemon.rotation.z = Math.PI / 2; lemon.rotation.y = 0.4;
    g.add(lemon);
    var rind = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.037, 12, 1, false, 0, Math.PI), toon(0xe8c93c));
    rind.position.copy(lemon.position); rind.rotation.copy(lemon.rotation);
    g.add(rind);
    return g;
  };

  /* مؤقت مطبخ لطيف */
  P.timer = function () {
    var body = toon(C.terracotta), face = toon(C.white), btn = toon(0x2e2a26);
    var g = G([
      M(rbox(0.34, 0.4, 0.16, 0.06, 3), body, 0, 0.2, 0),
      M(cyl(0.12, 0.12, 0.03, face, 16), face, 0, 0.26, 0.085, Math.PI / 2.5, 0, 0),
      M(box(0.016, 0.09, 0.012), btn, 0, 0.3, 0.105, 0, 0, 0.8)
    ]);
    return g;
  };

  /* ═══════════════ القلاية الهوائية ═══════════════ */

  function airfryer() {
    var bodyMat = toon(C.cream);
    var accentMat = toon(C.terracotta);
    var darkMat = toon(0x4e463c);
    var innerMat = toon(0x6b6156);

    var root = new THREE.Group();

    /* الجسم */
    root.add(M(rbox(2.5, 1.7, 2.1, 0.22, 4), bodyMat, 0, 0.95, 0));
    /* لوحة أمامية */
    root.add(M(rbox(0.9, 0.5, 0.06, 0.05, 2), darkMat, 0.75, 1.35, 1.03));

    /* شاشة درجة الحرارة */
    var cv = document.createElement('canvas');
    cv.width = 160; cv.height = 72;
    var ctx = cv.getContext('2d');
    var tex = new THREE.CanvasTexture(cv);
    var screen = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.28),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
    screen.position.set(0.75, 1.35, 1.065);
    root.add(screen);
    function drawScreen(main, sub) {
      ctx.fillStyle = '#332c24';
      ctx.fillRect(0, 0, 160, 72);
      ctx.fillStyle = '#ffd76a';
      ctx.font = 'bold 30px Arial, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(main, 80, sub ? 24 : 36);
      if (sub) {
        ctx.font = '20px Arial, sans-serif';
        ctx.fillStyle = '#f0b46a';
        ctx.fillText(sub, 80, 54);
      }
      tex.needsUpdate = true;
    }
    drawScreen('--');

    /* فتحات تهيئة علوية — تتوهج عند الطبخ */
    var vents = new THREE.Group();
    for (var v = 0; v < 6; v++) {
      vents.add(M(rbox(0.28, 0.05, 0.1, 0.02, 1), darkMat, -0.75 + (v % 3) * 0.32, 1.79, 0.5 - (v / 3 | 0) * 0.4));
    }
    root.add(vents);
    var glow = new THREE.PointLight(0xff8c3a, 0, 4.5, 2);
    glow.position.set(0, 1.55, 0);
    root.add(glow);

    /* السلة — منزلقة */
    var basket = new THREE.Group();
    basket.position.set(0, 0.52, 0.35);
    var drawer = G([
      M(rbox(2.1, 0.5, 1.85, 0.1, 3), accentMat, 0, 0.25, 0),
      M(rbox(1.8, 0.3, 1.5, 0.04, 2), innerMat, 0, 0.3, 0)
    ]);
    basket.add(drawer);
    /* مقبض */
    basket.add(M(rbox(0.9, 0.14, 0.16, 0.05, 2), bodyMat, 0, 0.42, 1.0));
    /* شبكة داخلية ترتكز عليها الأطعمة */
    var rack = M(rbox(1.7, 0.04, 1.4, 0.02, 1), darkMat, 0, 0.18, 0);
    basket.add(rack);
    root.add(basket);

    /* أرجل */
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (p) {
      root.add(M(cyl(0.09, 0.11, 0.12, darkMat, 10), darkMat, p[0] * 1.0, 0.06, p[1] * 0.8));
    });

    var BASKET_OUT = 1.55;
    return {
      root: root,
      basket: basket,
      rackY: 0.22,          /* ارتفاع الشبكة داخل السلة (محلياً) */
      cavity: { w: 1.7, d: 1.45 },  /* مساحة وضع الأطعمة */
      setBasket: function (t) { basket.position.z = 0.35 + BASKET_OUT * t; },
      setDisplay: drawScreen,
      setHeat: function (t) { glow.intensity = t * 0.9; }
    };
  }

  /* ═══════════════ بيئة المطبخ ═══════════════ */

  /* ظل دائري ناعم (blob) — أرخص وأكرتونية من shadow maps */
  function blobShadow(radius, opacity) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    var ctx = cv.getContext('2d');
    var grad = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
    grad.addColorStop(0, 'rgba(60,40,20,' + (opacity === undefined ? 0.32 : opacity) + ')');
    grad.addColorStop(1, 'rgba(60,40,20,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    var tex = new THREE.CanvasTexture(cv);
    var m = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  function environment() {
    var g = new THREE.Group();
    /* رخامة المطبخ */
    var top = M(rbox(11, 0.5, 6.5, 0.12, 2), toon(0xe2cf9f), 0, -0.25, 0);
    var front = M(box(11, 1.6, 0.2), toon(0xc9a05e), 0, -1.25, 3.15);
    g.add(top, front);
    /* بلاط خلفي بلون أدفأ */
    var wall = M(box(11, 5.5, 0.2), toon(0xf0dfc0), 0, 2.4, -3.3);
    g.add(wall);
    /* لوح خشبي زخرفي على الحائط */
    g.add(M(rbox(2.6, 1.5, 0.08, 0.06, 2), toon(0xd9b072), -3.4, 2.6, -3.15));
    g.add(M(rbox(1.6, 1.0, 0.08, 0.06, 2), toon(0xc9a05e), -0.4, 3.1, -3.15));
    /* ظل القلاية */
    var sh = blobShadow(2.1);
    sh.position.set(0, 0.005, 0.35);
    g.add(sh);
    return g;
  }

  /* ═══════════════ التصدير ═══════════════ */
  global.CC3D_MODELS = {
    init: init,
    toon: toon, M: M, G: G, sphere: sphere, box: box, rbox: rbox, cyl: cyl,
    capsule: capsule, torus: torus, lathe: lathe, blobShadow: blobShadow,
    markRaw: markRaw, applyDoneness: applyDoneness,
    palette: C,
    foods: F,
    props: P,
    airfryer: airfryer,
    environment: environment
  };
})(window);
