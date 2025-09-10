/**
 * Simple GLTFLoader for Three.js
 * Based on THREE.js GLTFLoader but simplified for our needs
 */

THREE.GLTFLoader = function() {
  this.manager = THREE.DefaultLoadingManager;
};

THREE.GLTFLoader.prototype = {
  
  constructor: THREE.GLTFLoader,
  
  load: function(url, onLoad, onProgress, onError) {
    const scope = this;
    const loader = new THREE.FileLoader(scope.manager);
    loader.setPath(scope.path);
    loader.setResponseType('arraybuffer');
    loader.setRequestHeader(scope.requestHeader);
    loader.setWithCredentials(scope.withCredentials);
    
    loader.load(url, function(data) {
      try {
        scope.parse(data, '', onLoad, onError);
      } catch (e) {
        if (onError) {
          onError(e);
        } else {
          console.error(e);
        }
        scope.manager.itemError(url);
      }
    }, onProgress, onError);
  },
  
  setPath: function(value) {
    this.path = value;
    return this;
  },
  
  setRequestHeader: function(value) {
    this.requestHeader = value;
    return this;
  },
  
  setWithCredentials: function(value) {
    this.withCredentials = value;
    return this;
  },
  
  parse: function(data, path, onLoad, onError) {
    const json = this.parseGLB(data);
    if (!json) {
      if (onError) onError(new Error('Invalid GLB file'));
      return;
    }
    
    // Create a simple scene with basic geometry for testing
    const scene = new THREE.Group();
    
    // Create a simple humanoid character
    const characterGroup = new THREE.Group();
    
    // Body
    const bodyGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.5);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 0.75;
    characterGroup.add(body);
    
    // Head
    const headGeometry = new THREE.SphereGeometry(0.25);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0xFFE0BD });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.8;
    head.name = 'Head';
    characterGroup.add(head);
    
    // Create arm bones that can be controlled
    const rightShoulder = new THREE.Object3D();
    rightShoulder.position.set(0.4, 1.4, 0);
    rightShoulder.name = 'RightShoulder';
    characterGroup.add(rightShoulder);
    
    const rightUpperArm = new THREE.Object3D();
    rightUpperArm.position.set(0, -0.3, 0);
    rightUpperArm.name = 'RightUpperArm';
    rightShoulder.add(rightUpperArm);
    
    const rightArmGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.6);
    const rightArmMaterial = new THREE.MeshLambertMaterial({ color: 0x4CAF50 });
    const rightArmMesh = new THREE.Mesh(rightArmGeometry, rightArmMaterial);
    rightArmMesh.position.y = -0.3;
    rightUpperArm.add(rightArmMesh);
    
    // Left arm
    const leftShoulder = new THREE.Object3D();
    leftShoulder.position.set(-0.4, 1.4, 0);
    leftShoulder.name = 'LeftShoulder';
    characterGroup.add(leftShoulder);
    
    const leftUpperArm = new THREE.Object3D();
    leftUpperArm.position.set(0, -0.3, 0);
    leftUpperArm.name = 'LeftUpperArm';
    leftShoulder.add(leftUpperArm);
    
    const leftArmMesh = new THREE.Mesh(rightArmGeometry.clone(), rightArmMaterial.clone());
    leftArmMesh.position.y = -0.3;
    leftUpperArm.add(leftArmMesh);
    
    // Store bone references for pose control
    const bones = {
      'Head': head,
      'RightShoulder': rightShoulder,
      'RightUpperArm': rightUpperArm,
      'LeftShoulder': leftShoulder,
      'LeftUpperArm': leftUpperArm,
      'rightArm': rightUpperArm,  // alias for MediaPipe compatibility
      'leftArm': leftUpperArm     // alias for MediaPipe compatibility
    };
    
    characterGroup.userData = { bones: bones };
    scene.add(characterGroup);
    
    // Create GLTF-like result object
    const result = {
      scene: scene,
      scenes: [scene],
      animations: [],
      cameras: [],
      asset: {},
      parser: this,
      userData: {}
    };
    
    if (onLoad) onLoad(result);
  },
  
  parseGLB: function(data) {
    // For now, just return a dummy JSON to trigger the parse function
    // In a real implementation, this would parse the GLB binary format
    return { asset: { version: "2.0" } };
  }
};