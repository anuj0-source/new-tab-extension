/* ═══════════════════════════════════════════════════════
   DOG3D.JS — Interactive Developer Pet Dog
   ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── DOM ── */
  const canvas = document.getElementById('dog-canvas');
  const sceneWrap = document.getElementById('pet-scene');
  const bubble = document.getElementById('pet-bubble');
  const bubbleText = document.getElementById('pet-bubble-text');
  const statusDot = document.getElementById('pet-dot');
  const stateLabel = document.getElementById('pet-state-text');
  if (!canvas || !sceneWrap) return;

  /* ── Config ── */
  const IDLE_TIMEOUT = 20000;        // ms before dog sleeps
  const TIP_INTERVAL_MIN = 15000;    // ms
  const TIP_INTERVAL_MAX = 20000;
  const TIP_DISPLAY = 4000;          // ms to show bubble
  const WALK_INTERVAL_MIN = 30000;   // ms between random walks
  const WALK_INTERVAL_MAX = 60000;

  /* ── Developer Tips ── */
  const TIPS = [
    "Push your code to GitHub 📈",
    "Time to solve a LeetCode problem 🔥",
    "Remember to commit today 💻",
    "Debugging makes you stronger 🧠",
    "Keep coding, developer 🚀",
    "Don't forget to take breaks ☕",
    "Write clean code today ✨",
    "Review your pull requests 📝",
    "Learn something new today 📚",
    "Ship that feature! 🚢",
    "Tests are your friends 🧪",
    "Git add, commit, push! 🏗️",
    "Stay curious, stay coding 💡",
    "Refactor that messy function 🧹",
    "Document your code! 📖"
  ];

  const HAPPY_MSGS = [
    "Good job, developer! 🐶",
    "Woof! You're awesome! 🎉",
    "Keep it up, coder! 💪",
    "*happy tail wag* 🐕",
    "You're the best! ⭐"
  ];

  /* ── Three.js Setup ── */
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 1.2, 4);
  camera.lookAt(0, 0.5, 0);

  const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  /* ── Lighting (Day/Night Aware) ── */
  const hour = new Date().getHours();
  const isNight = hour >= 20 || hour < 6;
  
  // Nighttime gets a cooler, dimmer lighting. Daytime gets bright sunlight.
  const skyColor   = isNight ? 0x2c3e50 : 0x87ceeb;
  const groundColor= isNight ? 0x111111 : 0x362d22;
  const hemiIntens = isNight ? 0.3 : 0.6;
  
  const hemi = new THREE.HemisphereLight(skyColor, groundColor, hemiIntens);
  scene.add(hemi);

  const mainLightColor = isNight ? 0x6e88a3 : 0xfff5e8;
  const mainLightIntens= isNight ? 0.5 : 1.2;
  const key = new THREE.DirectionalLight(mainLightColor, mainLightIntens);
  key.position.set(3, 5, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 20;
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0x8ec8f0, isNight ? 0.2 : 0.4);
  fill.position.set(-3, 3, -2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffd4a6, isNight ? 0.1 : 0.3);
  rim.position.set(0, 2, -4);
  scene.add(rim);
  
  // Ambient lighting for minimum visibility
  const ambient = new THREE.AmbientLight(0xffffff, isNight ? 0.2 : 0.6);
  scene.add(ambient);

  /* ── Ground plane (Invisible Shadow Catcher) ── */
  const groundGeo = new THREE.CircleGeometry(3, 64);
  const groundMat = new THREE.ShadowMaterial({
    opacity: 0.3
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ── State ── */
  let dogModel = null;
  let mixer = null;
  let actions = {};
  let currentAction = null;
  let state = 'idle';       // idle, sleeping, happy, walking
  let lastActivity = Date.now();
  let mouseNDC = { x: 0, y: 0 };
  let dogTargetRotY = 0;
  let dogTargetHeadRotX = 0;
  let walkTargetX = 0;
  let isWalking = false;
  let isDragging = false;
  let dragStartMouse = { x: 0, y: 0 };
  let dogBasePosition = { x: 0, z: 0 };
  let isEating = false;
  let eatTimer = 0;

  // Load saved position
  try {
    const saved = JSON.parse(localStorage.getItem('petDogPos'));
    if (saved) dogBasePosition = saved;
  } catch (e) { }

  /* ── Load GLB Model ── */
  const loader = new THREE.GLTFLoader();
  loader.load(
    'dog.glb',
    function (gltf) {
      dogModel = gltf.scene;

      // Auto-scale and center the model
      const initialBox = new THREE.Box3().setFromObject(dogModel);
      const size = initialBox.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 2.0 / (maxDim || 1);
      
      console.log('Original Model Size:', size.x, size.y, size.z, 'Scaling by:', scale);
      dogModel.scale.setScalar(scale);

      // FORCE update the world matrix recursively so the Box3 calculations are accurate
      dogModel.updateMatrixWorld(true);

      // Recompute bounding box after scaling to accurately center it
      const scaledBox = new THREE.Box3().setFromObject(dogModel);
      const center = scaledBox.getCenter(new THREE.Vector3());

      dogModel.position.x = dogModel.position.x - center.x + dogBasePosition.x;
      dogModel.position.y = dogModel.position.y - scaledBox.min.y; // Rest on ground
      dogModel.position.z = dogModel.position.z - center.z + dogBasePosition.z;
      
      // Update matrices again now that position has changed
      dogModel.updateMatrixWorld(true);
      
      console.log('Model positioned at:', dogModel.position);

      // Enable shadows
      dogModel.traverse(function (child) {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      scene.add(dogModel);

      // Setup animations if present
      if (gltf.animations && gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(dogModel);
        
        console.group('🐕 Dog Animations Found:');
        gltf.animations.forEach(function (clip) {
          console.log(`- ${clip.name}`);
          const action = mixer.clipAction(clip);
          actions[clip.name.toLowerCase()] = action; // store lowercase for easier matching
        });
        console.groupEnd();

        // Attempt to find the best matching idle animation
        let idleActionName = Object.keys(actions).find(n => n.includes('idle') || n.includes('stand') || n.includes('breathe'));
        
        // Play the idle or first animation
        const firstClip = gltf.animations[0];
        if (idleActionName) {
           currentAction = actions[idleActionName];
           currentAction.play();
        } else if (firstClip) {
          currentAction = mixer.clipAction(firstClip);
          currentAction.play();
        }
      }

      setStatus('awake');
      showBubble("Hello, developer! I'm your coding buddy 🐶");
    },
    undefined,
    function (err) {
      console.warn('GLB load failed, creating procedural dog:', err);
      createProceduralDog();
    }
  );

  /* ── Procedural Fallback Dog ── */
  function createProceduralDog() {
    dogModel = new THREE.Group();

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd4a574, roughness: 0.7 });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf5ede3, roughness: 0.7 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a1f14, roughness: 0.6 });
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.3 });
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.2 });
    const tongueMat = new THREE.MeshStandardMaterial({ color: 0xef8888, roughness: 0.5 });

    function sphere(r, mat) {
      return new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), mat);
    }

    // Body
    const body = sphere(0.4, bodyMat);
    body.scale.set(1, 0.85, 1.3);
    body.position.set(0, 0.45, 0);
    dogModel.add(body);

    // Head
    const head = new THREE.Group();
    const skull = sphere(0.28, bodyMat);
    head.add(skull);
    const snout = sphere(0.16, whiteMat);
    snout.position.set(0, -0.06, 0.2);
    snout.scale.set(0.9, 0.7, 1.1);
    head.add(snout);
    const nose = sphere(0.045, noseMat);
    nose.position.set(0, -0.02, 0.35);
    head.add(nose);

    // Eyes
    const eyeL = sphere(0.04, eyeMat);
    eyeL.position.set(-0.1, 0.05, 0.22);
    head.add(eyeL);
    const eyeR = sphere(0.04, eyeMat);
    eyeR.position.set(0.1, 0.05, 0.22);
    head.add(eyeR);

    // Ears
    const earGeo = new THREE.ConeGeometry(0.09, 0.18, 8);
    const earL = new THREE.Mesh(earGeo, darkMat);
    earL.position.set(-0.16, 0.22, 0.02);
    earL.rotation.z = 0.3;
    head.add(earL);
    const earR = new THREE.Mesh(earGeo, darkMat);
    earR.position.set(0.16, 0.22, 0.02);
    earR.rotation.z = -0.3;
    head.add(earR);

    // Tongue
    const tongue = sphere(0.04, tongueMat);
    tongue.position.set(0, -0.14, 0.25);
    tongue.scale.set(0.7, 0.4, 1);
    tongue.name = 'tongue';
    head.add(tongue);

    head.position.set(0, 0.75, 0.35);
    head.name = 'head';
    dogModel.add(head);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.06, 0.055, 0.35, 8);
    const positions = [[-0.15, 0.17, 0.25], [0.15, 0.17, 0.25], [-0.15, 0.17, -0.25], [0.15, 0.17, -0.25]];
    positions.forEach(function (p) {
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.set(p[0], p[1], p[2]);
      leg.castShadow = true;
      dogModel.add(leg);
      // Paw
      const paw = sphere(0.065, whiteMat);
      paw.position.set(p[0], 0.02, p[2]);
      paw.scale.set(1, 0.5, 1.2);
      dogModel.add(paw);
    });

    // Tail
    const tailGroup = new THREE.Group();
    tailGroup.name = 'tail';
    for (let i = 0; i < 5; i++) {
      const seg = sphere(0.04 - i * 0.005, bodyMat);
      seg.position.set(0, i * 0.06, -i * 0.04);
      tailGroup.add(seg);
    }
    tailGroup.position.set(0, 0.55, -0.45);
    dogModel.add(tailGroup);

    dogModel.position.set(dogBasePosition.x, 0, dogBasePosition.z);
    dogModel.traverse(function (c) {
      if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
    });

    scene.add(dogModel);
    setStatus('awake');
    showBubble("Hello, developer! I'm your coding buddy 🐶");
  }

  /* ── Resize ── */
  function resize() {
    const rect = sceneWrap.getBoundingClientRect();
    const w = rect.width;
    const h = rect.height;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', resize);
  new ResizeObserver(resize).observe(sceneWrap);
  setTimeout(resize, 100);

  /* ── Speech Bubbles ── */
  let bubbleTimer = null;
  let tipTimer = null;

  function showBubble(text, duration) {
    duration = duration || TIP_DISPLAY;
    bubbleText.textContent = text;
    bubble.classList.remove('hidden');

    // Force re-animation
    bubble.style.animation = 'none';
    bubble.offsetHeight;
    bubble.style.animation = '';

    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(function () {
      bubble.classList.add('hidden');
    }, duration);
  }

  function scheduleTip() {
    const delay = TIP_INTERVAL_MIN + Math.random() * (TIP_INTERVAL_MAX - TIP_INTERVAL_MIN);
    tipTimer = setTimeout(function () {
      if (state !== 'sleeping') {
        const tip = TIPS[Math.floor(Math.random() * TIPS.length)];
        showBubble(tip);
      }
      scheduleTip();
    }, delay);
  }
  scheduleTip();

  /* ── Status ── */
  function setStatus(s) {
    statusDot.className = 'pet-status-dot';
    if (s === 'sleeping') {
      statusDot.classList.add('sleeping');
      stateLabel.textContent = 'sleeping';
    } else if (s === 'happy') {
      statusDot.classList.add('happy');
      stateLabel.textContent = 'happy';
    } else if (s === 'walking') {
      stateLabel.textContent = 'exploring';
    } else if (s === 'eating') {
      stateLabel.textContent = 'eating';
    } else {
      stateLabel.textContent = 'awake';
    }
  }

  /* ── Idle Detection ── */
  function onActivity() {
    lastActivity = Date.now();
    if (state === 'sleeping') {
      wakeUp();
    }
  }
  document.addEventListener('mousemove', function (e) {
    // Track NDC for cursor following
    const rect = sceneWrap.getBoundingClientRect();
    mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    onActivity();
  });
  document.addEventListener('keydown', onActivity);
  document.addEventListener('click', onActivity);
  document.addEventListener('scroll', onActivity);

  function goToSleep() {
    if (state === 'sleeping') return;
    state = 'sleeping';
    setStatus('sleeping');
    showBubble("💤 zzz...", 3000);

    // Tilt dog down (sleeping pose)
    if (dogModel) {
      dogSleepTween = true;
    }
  }

  function wakeUp() {
    state = 'idle';
    setStatus('awake');
    showBubble("*yawn* Back to coding! ☀️", 2500);
    dogSleepTween = false;
  }

  let dogSleepTween = false;

  /* ── Random Walking ── */
  function scheduleWalk() {
    const delay = WALK_INTERVAL_MIN + Math.random() * (WALK_INTERVAL_MAX - WALK_INTERVAL_MIN);
    setTimeout(function () {
      if (state === 'idle' && !isDragging) {
        startWalk();
      }
      scheduleWalk();
    }, delay);
  }
  scheduleWalk();

  function startWalk() {
    state = 'walking';
    isWalking = true;
    setStatus('walking');
    walkTargetX = (Math.random() - 0.5) * 1.5; // random X target
    
    // 50% chance to eat instead of walking when idle
    if (Math.random() > 0.5) {
      isWalking = false;
      startEat();
      return;
    }

    setTimeout(function () {
      isWalking = false;
      if (state === 'walking') {
        state = 'idle';
        setStatus('awake');
      }
    }, 3000);
  }

  /* ── Eating ── */
  function startEat() {
    state = 'eating';
    isEating = true;
    eatTimer = 0;
    setStatus('eating');
    showBubble("*nom nom nom* 🦴", 3000);
    setTimeout(function () {
      isEating = false;
      if (state === 'eating') {
        state = 'idle';
        setStatus('awake');
      }
    }, 4000);
  }

  /* ── Click Interaction ── */
  canvas.addEventListener('click', function (e) {
    if (isDragging) return;
    if (!dogModel) return;

    state = 'happy';
    setStatus('happy');
    const msg = HAPPY_MSGS[Math.floor(Math.random() * HAPPY_MSGS.length)];
    showBubble(msg, 3000);

    // Trigger happy jump
    happyJump = true;
    happyJumpStart = Date.now();

    setTimeout(function () {
      if (state === 'happy') {
        state = 'idle';
        setStatus('awake');
        happyJump = false;
      }
    }, 2000);
  });

  let happyJump = false;
  let happyJumpStart = 0;

  /* ── Drag & Move ── */
  let dragStartPos = null;

  canvas.addEventListener('mousedown', function (e) {
    dragStartMouse = { x: e.clientX, y: e.clientY };
    dragStartPos = dogModel ? { x: dogModel.position.x, z: dogModel.position.z } : null;
    isDragging = false;
  });

  document.addEventListener('mousemove', function (e) {
    if (!dragStartPos || !dogModel) return;
    const dx = e.clientX - dragStartMouse.x;
    const dz = e.clientY - dragStartMouse.y;
    if (Math.abs(dx) > 5 || Math.abs(dz) > 5) {
      isDragging = true;
      const scale = 0.008;
      dogModel.position.x = dragStartPos.x + dx * scale;
      dogModel.position.z = dragStartPos.z + dz * scale;
      dogBasePosition.x = dogModel.position.x;
      dogBasePosition.z = dogModel.position.z;
    }
  });

  document.addEventListener('mouseup', function () {
    if (isDragging && dogModel) {
      try {
        localStorage.setItem('petDogPos', JSON.stringify(dogBasePosition));
      } catch (e) { }
    }
    dragStartPos = null;
    setTimeout(function () { isDragging = false; }, 50);
  });

  /* ── Dashboard Event Reactions ── */
  function watchDashboardEvents() {
    // Watch GitHub profile section
    const ghProf = document.getElementById('gh-prof');
    if (ghProf) {
      const observer = new MutationObserver(function () {
        if (!ghProf.classList.contains('hidden') && state !== 'sleeping') {
          showBubble("GitHub loaded! Keep those commits going 🟢", 3500);
        }
      });
      observer.observe(ghProf, { attributes: true, attributeFilter: ['class'] });
    }

    // Watch LeetCode section
    const lcProf = document.getElementById('lc-prof');
    if (lcProf) {
      const observer = new MutationObserver(function () {
        if (!lcProf.classList.contains('hidden') && state !== 'sleeping') {
          showBubble("LeetCode time! You've got this 🧠🔥", 3500);
        }
      });
      observer.observe(lcProf, { attributes: true, attributeFilter: ['class'] });
    }

    // Watch WakaTime section
    const wakaProf = document.getElementById('waka-prof');
    if (wakaProf) {
      const observer = new MutationObserver(function () {
        if (!wakaProf.classList.contains('hidden') && state !== 'sleeping') {
          showBubble("Coding stats loaded! Impressive work 📊", 3500);
        }
      });
      observer.observe(wakaProf, { attributes: true, attributeFilter: ['class'] });
    }

    // Check for long idle and suggest coding
    setInterval(function () {
      const idle = Date.now() - lastActivity;
      if (idle > 60000 && state === 'sleeping') {
        showBubble("Let's get back to coding 💻", 4000);
      }
    }, 30000);
  }
  setTimeout(watchDashboardEvents, 2000);

  /* ── ZZZ Particles for Sleeping ── */
  const zzzParticles = [];
  const zzzMat = new THREE.SpriteMaterial({
    color: 0x6699cc,
    transparent: true,
    opacity: 0.7,
    sizeAttenuation: true
  });

  function spawnZzz() {
    if (state !== 'sleeping' || !dogModel) return;
    const sprite = new THREE.Sprite(zzzMat.clone());
    sprite.scale.set(0.15, 0.15, 1);
    sprite.position.set(
      dogModel.position.x + (Math.random() - 0.5) * 0.3,
      dogModel.position.y + 1.2,
      dogModel.position.z
    );
    sprite.userData = { life: 0, speed: 0.3 + Math.random() * 0.2 };
    scene.add(sprite);
    zzzParticles.push(sprite);
  }

  let zzzTimer = 0;

  /* ── Animation Loop ── */
  const clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    // Update animation mixer
    if (mixer) mixer.update(dt);

    // Idle detection
    if (state !== 'sleeping' && state !== 'happy' && Date.now() - lastActivity > IDLE_TIMEOUT) {
      goToSleep();
    }

    if (dogModel) {
      // ── Cursor tracking (head follows mouse) ──
      if (state !== 'sleeping' && state !== 'eating') {
        const targetRotY = mouseNDC.x * 0.5;
        const targetRotX = -mouseNDC.y * 0.2;
        dogTargetRotY += (targetRotY - dogTargetRotY) * 2 * dt;
        dogTargetHeadRotX += (targetRotX - dogTargetHeadRotX) * 2 * dt;

        // Rotate the whole model slightly toward cursor
        dogModel.rotation.y += (dogTargetRotY * 0.4 - dogModel.rotation.y) * 3 * dt;
      }

      // ── Sleeping pose ──
      if (state === 'sleeping') {
        // Lay down math
        dogModel.rotation.x += (Math.PI / 2.5 - dogModel.rotation.x) * 2 * dt; // Tilt forward
        dogModel.position.y += (-0.15 - dogModel.position.y) * 2 * dt; // Sink into ground
        dogModel.rotation.y += (0 - dogModel.rotation.y) * 2 * dt; // Straighten

        // Breathing while asleep
        const sleepBreathe = Math.sin(elapsed * 1.5) * 0.02;
        dogModel.scale.set(
          dogModel.scale.x,
          dogModel.scale.x + sleepBreathe,
          dogModel.scale.z
        );

        // ZZZ particles
        zzzTimer += dt;
        if (zzzTimer > 0.8) {
          zzzTimer = 0;
          spawnZzz();
        }
      } else {
        // Return to upright slowly if not eating/sleeping
        if (state !== 'eating') {
           dogModel.rotation.x += (0 - dogModel.rotation.x) * 3 * dt;
        }
      }

      // ── Happy jump (Play) ──
      if (happyJump) {
        const t = (Date.now() - happyJumpStart) / 1000;
        const jumpHeight = Math.abs(Math.sin(t * 8)) * 0.25 * Math.max(0, 1 - t * 0.5);
        dogModel.position.y = jumpHeight;
        dogModel.rotation.y += Math.sin(t * 15) * 0.1 * dt; // wiggle in air
      }

      // ── Eating animation ──
      if (isEating) {
        eatTimer += dt;
        // Bob head up and down aggressively
        const eatDip = Math.abs(Math.sin(eatTimer * 10)) * 0.4;
        dogModel.rotation.x += (eatDip - dogModel.rotation.x) * 5 * dt;
        dogModel.position.y += (-0.05 - dogModel.position.y) * 5 * dt;
      }

      // ── Random walking ──
      if (isWalking) {
        const moveSpeed = 0.3 * dt;
        const dx = walkTargetX - dogModel.position.x;
        if (Math.abs(dx) > 0.05) {
          dogModel.position.x += Math.sign(dx) * moveSpeed;
          dogModel.rotation.y = Math.sign(dx) * 0.8; // face direction of travel
          
          // Walking bob
          const walkBob = Math.abs(Math.sin(elapsed * 10)) * 0.05;
          dogModel.position.y += (walkBob - dogModel.position.y) * 5 * dt;
          
          dogBasePosition.x = dogModel.position.x;
        }
      }

      // ── Idle animations ──
      if (state === 'idle' || state === 'walking') {
        // Gentle breathing (scaling the body)
        const breathe = Math.sin(elapsed * 2) * 0.02;
        dogModel.scale.set(
          dogModel.scale.x,
          dogModel.scale.x + breathe,
          dogModel.scale.z
        );
        if (!isWalking && !happyJump) {
           dogModel.position.y += (0 - dogModel.position.y) * 2 * dt;
        }
      }

      // Reset scale on wake/stand
      if (state !== 'idle' && state !== 'walking' && state !== 'sleeping') {
        const initialBox = new THREE.Box3().setFromObject(dogModel);
        // We rely on the breathe logic overriding scale softly, but if needed, we reset here
      }

      // ── Tongue animation ──
      const tongue = dogModel.getObjectByName('tongue');
      if (tongue && state !== 'sleeping') {
        tongue.scale.y = 0.4 + Math.sin(elapsed * 4) * 0.08;
      }
    }

    // Update ZZZ particles
    for (let i = zzzParticles.length - 1; i >= 0; i--) {
      const p = zzzParticles[i];
      p.userData.life += dt;
      p.position.y += p.userData.speed * dt;
      p.position.x += Math.sin(p.userData.life * 2) * 0.2 * dt;
      p.material.opacity = Math.max(0, 0.7 - p.userData.life * 0.4);
      if (p.userData.life > 2) {
        scene.remove(p);
        p.material.dispose();
        zzzParticles.splice(i, 1);
      }
    }

    renderer.render(scene, camera);
  }

  animate();
})();
