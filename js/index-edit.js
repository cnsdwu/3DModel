let data = {};

let eventArr = [];
// 添加事件
THREE.Group.prototype.addEvent = THREE.Mesh.prototype.addEvent = function (
  type,
  callback,
  leaveback
) {
  eventArr.push({
    type,
    object: getMesh(this),
    callback,
    leaveback,
  });
};
// 移除事件
THREE.Group.prototype.removeEvent = THREE.Mesh.prototype.removeEvent = function (
  type
) {
  eventArr = eventArr.filter((item) => {
    if (item.type == type) {
      return false;
    }
    return true;
  });
};

// 遍历获取组里的Mesh
function getMesh(object) {
  let resArr = [];
  if (object.type == "Mesh") {
    resArr.push(object);
  } else if (object.type == "Group") {
    for (let item of object.children) {
      if (item.type == "Mesh") {
        resArr.push(item);
      } else if (item.type == "Group") {
        resArr = resArr.concat(getMesh(item));
      }
    }
  }
  return resArr;
}

let container,
  scene, // 场景
  camera, // 相机
  controls, // 控制器
  renderer, // 渲染参数
  mixer, // 动画混合器
  pointLight, // 点光源 用于绑定相机
  ambientLight, // 环境光
  mesh2,
  transformControls, // 变换控件
  rightClickMesh, // 右键对象
  group; // 分组
let flagAnimation = false; // 标记是否包含动画
let clock = new THREE.Clock(); // 时钟 用于动画
let raycaster = new THREE.Raycaster(); // 射线 用于检测事件
let elContextmenu = document.querySelector("#contextmenu"); // 右键元素
let toast = new ToastClass(); // 提示

// 获取数据
fetch("data/data.json", {
  method: "POST",
  body: objectToUrlParams({
    act: "get",
  }),
  headers: {
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  },
})
  .then((res) => {
    if (res.status == 200) {
      return res.json();
    }
  })
  .then((res) => {
    if (res && res.status) {
      data = res.msg;
      init(); // 执行初使化
      animate(); // 执行动画 随后会按帧 重复执行
    }
  });

// 初使化函数
function init() {
  // 设置标题
  document.title = data.rname;
  // 设置背景
  if (data.background)
    document.body.style.background = `url('${data.background}') no-repeat center/cover`;

  // 创建div 并添加加到页面中
  container = document.createElement("div");
  document.body.appendChild(container);

  // 点光强range设置
  document.querySelector("#lightPower").value = parseFloat(data.point_light_power);
  // 环境光强range设置
  document.querySelector("#ambientColor").value = parseInt(data.ambient_light_color);

  // 相机
  camera = new THREE.PerspectiveCamera(
    30, // fov
    window.innerWidth / window.innerHeight,
    1,
    2000 //可显示的范围
  );
  // 设置初使相机的位置
  camera.position.set(
    parseFloat(data.camera_position_x),
    parseFloat(data.camera_position_y),
    parseFloat(data.camera_position_z)
  );

  // 创建场景
  scene = new THREE.Scene();
  // scene.background = new THREE.Color(0xa0a0a0); // 背景颜色
  // scene.fog = new THREE.Fog(0xa0a0a0, 200, 1000); // 设置雾
  // 组
  group = new THREE.Group();
  scene.add(group); // 将组添加到场景中

  // 光源
  // 环境光
  ambientLight = new THREE.AmbientLight(`rgb(${parseInt(data.ambient_light_color)},${parseInt(data.ambient_light_color)},${data.ambient_light_color})`);
  scene.add(ambientLight); //环境光对象添加到scene场景中
  //点光源
  pointLight = new THREE.PointLight(0xffffff);
  pointLight.power = parseFloat(data.point_light_power) * Math.PI; // 光强 默认4PI
  //设置点光源位置，改变光源的位置
  pointLight.position.copy(camera.position);
  scene.add(pointLight);


  // 加载模型
  let loader = new THREE.FBXLoader(); //创建一个FBX加载器
  loader.load(data.fbx, function (object) {
    if (object.animations.length > 0) {
      flagAnimation = true;
      mixer = new THREE.AnimationMixer(object);
      let action = mixer.clipAction(object.animations[0]);
      action.play();
      object.traverse(function (child) {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
    object.children.forEach(function (child) {
      if(child.material) child.material.shininess = 8;
    });
    scene.add(object);
  });

  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  //设置相机距离原点的最远距离
  // controls.minDistance  = 10;
  //设置相机距离原点的最远距离
  // controls.maxDistance  = 200;
  controls.enableDamping = true;
  controls.target.set(
    parseFloat(data.controls_position_x),
    parseFloat(data.controls_position_y),
    parseFloat(data.controls_position_z)
  );
  controls.update();

  // 变换控制
  transformControls = new THREE.TransformControls(camera, renderer.domElement);
  transformControls.addEventListener("change", () => {
    renderer.render(scene, camera);
  });

  transformControls.addEventListener("dragging-changed", function (event) {
    controls.enabled = !event.value;
  });

  scene.add(transformControls);

  if (data.hotspot && data.hotspot.length > 0) {
    for (let item of data.hotspot) {
      let mesh = new THREE.Mesh(
        new THREE.SphereGeometry(item.radius, 40, 40),
        new THREE.MeshLambertMaterial({
          color: item.color,
        })
      ); //网格模型对象Mesh
      mesh.position.set(
        parseFloat(item.position_x),
        parseFloat(item.position_y),
        parseFloat(item.position_z)
      );
      mesh.rotation.set(
        parseFloat(item.rotation_x),
        parseFloat(item.rotation_y),
        parseFloat(item.rotation_z)
      );
      mesh.scale.set(
        parseFloat(item.scale_x),
        parseFloat(item.scale_y),
        parseFloat(item.scale_z)
      );
      mesh.name = item.title;
      mesh.userData = {
        color: item.color,
        html: item.html,
        id: item.id || 0,
      };
      group.add(mesh); //网格模型添加到场景中
      mesh.addEvent("contextmenu", (e, info) => {
        elContextmenu.querySelector(".name").innerHTML = mesh.name;
        elContextmenu.style.left = e.pageX + "px";
        elContextmenu.style.top = e.pageY + "px";
        elContextmenu.classList.add("show");
        rightClickMesh = mesh;
      });
      mesh.addEvent("click", (e, info) => {
        transformControls.attach(mesh);
      });
    }
  }

  // 监听事件
  window.addEventListener("resize", onWindowResize, false);
  window.addEventListener("mousemove", onEvent, false);
  window.addEventListener("click", onEvent, false);
  window.addEventListener("mouseover", onEvent, false);
  window.addEventListener("contextmenu", onEvent, false);
  window.addEventListener("mousedown", onEvent, false);
  window.addEventListener("keydown", function (event) {
    switch (event.keyCode) {
      case 81: // Q
        transformControls.setSpace(
          transformControls.space === "local" ? "world" : "local"
        );
        break;

      case 16: // Shift
        transformControls.setTranslationSnap(100);
        transformControls.setRotationSnap(THREE.MathUtils.degToRad(15));
        transformControls.setScaleSnap(0.25);
        break;

      case 87: // W
        transformControls.setMode("translate");
        break;

      case 69: // E
        transformControls.setMode("rotate");
        break;

      case 82: // R
        transformControls.setMode("scale");
        break;

      case 187:
      case 107: // +, =, num+
        transformControls.setSize(transformControls.size + 0.1);
        break;

      case 189:
      case 109: // -, _, num-
        transformControls.setSize(Math.max(transformControls.size - 0.1, 0.1));
        break;

      case 88: // X
        transformControls.showX = !transformControls.showX;
        break;

      case 89: // Y
        transformControls.showY = !transformControls.showY;
        break;

      case 90: // Z
        transformControls.showZ = !transformControls.showZ;
        break;

      case 32: // Spacebar
        transformControls.enabled = !transformControls.enabled;
        break;
    }
  });

  window.addEventListener("keyup", function (event) {
    switch (event.keyCode) {
      case 16: // Shift
        transformControls.setTranslationSnap(null);
        transformControls.setRotationSnap(null);
        transformControls.setScaleSnap(null);
        break;
    }
  });
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  // directionalLight.position.copy( camera.position );
  requestAnimationFrame(animate);

  pointLight.position.copy(camera.position);
  if (flagAnimation) {
    let delta = clock.getDelta();

    if (mixer) mixer.update(delta);
  }
  controls.update();
  renderer.render(scene, camera);

}

function onEvent(event) {
  // 如果为鼠标按下时，将右键菜单隐藏
  if (event.type == "mousedown") {
    elContextmenu.classList.remove("show");
  }
  for (let item of eventArr) {
    if (event.type == item.type) {
      let mouse = new THREE.Vector2(1, 1);
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      let intersects = raycaster.intersectObjects(
        Array.isArray(item.object) ? item.object : [item.object]
      );
      if (intersects.length > 0) {
        item.callback &&
          typeof item.callback == "function" &&
          item.callback(event, intersects);
        if (item.leaveback) {
          item.leaveback.flagFirst = false;
        }
      } else if (item.leaveback && typeof item.leaveback == "function") {
        if (item.leaveback.flagFirst === false) {
          item.leaveback();
          item.leaveback.flagFirst = true;
        }
      }
    }
  }
}

// 点击添加时的遮罩
document.querySelector("#formMask").addEventListener("click", (e) => {
  document.querySelector("#centerCenter").classList.remove("show");
});
// 点击添加按钮
document.querySelector("#btnAddHotspot").addEventListener("click", (e) => {
  document.querySelector("#centerCenter").classList.add("show");
});
// 点击提交按钮
document.querySelector("#formSubmit").addEventListener("click", (e) => {
  let elTitle = document.querySelector("#title");
  let elColor = document.querySelector("#color");
  let title = elTitle.value;
  let color = elColor.value;
  let content = ue.getContent();
  if (title.length == 0 || title.length > 50) {
    toast.show({
      text: "请输入1到100个字符以内的标题",
      duration: 1000,
    });
    return false;
  }
  if (content.length == 0) {
    toast.show({
      text: "内容不能为空",
      duration: 1000,
    });
    return false;
  }

  document.querySelector("#centerCenter").classList.remove("show");
  let mesh = null;
  if (rightClickMesh) {
    mesh = rightClickMesh;
    mesh.material.color.set(color);
  } else {
    let item = {
      radius: 1,
      position: {
        x: 5,
        y: 5,
        z: 5,
      },
      scale: {
        x: 1,
        y: 1,
        z: 1,
      },
      rotation: {
        x: 0,
        y: 0,
        z: 0,
      },
    };
    // 创建场景物体
    mesh = new THREE.Mesh(
      new THREE.SphereGeometry(item.radius, 40, 40),
      new THREE.MeshLambertMaterial({
        color,
      })
    ); //网格模型对象Mesh
    mesh.position.set(item.position.x, item.position.y, item.position.z);
    group.add(mesh); //网格模型添加到场景中
    mesh.addEvent("contextmenu", (e, info) => {
      elContextmenu.querySelector(".name").innerHTML = mesh.name;
      elContextmenu.style.left = e.pageX + "px";
      elContextmenu.style.top = e.pageY + "px";
      elContextmenu.classList.add("show");
      rightClickMesh = mesh;
    });
    mesh.addEvent("click", (e, info) => {
      transformControls.attach(mesh);
    });
  }

  mesh.name = title;
  mesh.userData = {
    html: content,
    id:mesh.userData.id || 0,
    color,
  };
  transformControls.attach(mesh);

  ue.setContent("");
  elTitle.value = "";
});

// 点击保存按钮
document.querySelector("#btnSave").addEventListener("click", (e) => {
  let tempArr = [];
  for (let obj of group.children) {
    tempArr.push({
      id: obj.userData.id,
      radius: 1,
      color: obj.userData.color,
      position_x: obj.position.x,
      position_y: obj.position.y,
      position_z: obj.position.z,
      scale_x: obj.scale.x,
      scale_y: obj.scale.y,
      scale_z: obj.scale.z,
      rotation_x: obj.rotation.x,
      rotation_y: obj.rotation.y,
      rotation_z: obj.rotation.z,
      title: obj.name,
      html: obj.userData.html,
    });
  }
  data.hotspot = tempArr;
  data.point_light_power = parseFloat(document.querySelector("#lightPower").value);
  data.ambient_light_color = parseInt(document.querySelector("#ambientColor").value);
  toast.show({
    text: "保存中",
    loading: true,
  });
  // 提交数据
  fetch("/edit/ring_around", {
    method: "POST",
    body: JSON.stringify({
      act: "editor_ring",
      data,
    }),
  })
    .then((res) => {
      if (res.status == 200) {
        toast.hide();
        return res.json();
      }
    })
    .then((res) => {
      if (res && res.status) {
        toast.show({
          text: "保存成功",
          duration: 1000,
        });
        setTimeout(() => {
          window.location.reload();
        }, 1000);
      } else {
        toast.show({
          text: "保存失败",
          duration: 1000,
        });
      }
    })
    .catch((error) => {
      toast.show({
        text: "保存失败",
        duration: 1000,
      });
    });
});

// 点击设置视角
document.querySelector("#btnSetAngle").addEventListener("click", (e) => {
  data.camera_position_x = camera.position.x;
  data.camera_position_y = camera.position.y;
  data.camera_position_z = camera.position.z;
  data.controls_position_x = controls.target.x;
  data.controls_position_y = controls.target.y;
  data.controls_position_z = controls.target.z;
  toast.show({
    text: "设置成功，记得及时保存",
    duration: 1000,
  });
});

// 弹出菜单阻止消失
elContextmenu.addEventListener("mousedown", (e) => {
  e.stopPropagation();
});
// 右键点击编辑
document.querySelector("#btnEditor").addEventListener("click", (e) => {
  let elTitle = document.querySelector("#title");
  let elColor = document.querySelector("#color");
  document.querySelector("#centerCenter").classList.add("show");
  elTitle.value = rightClickMesh.name;
  elColor.value = rightClickMesh.userData.color;
  ue.setContent(rightClickMesh.userData.html);
});
// 右键点击删除
document.querySelector("#btnDelete").addEventListener("click", (e) => {
  transformControls.detach();
  rightClickMesh.removeEvent("click");
  rightClickMesh.removeEvent("contextmenu");
  group.remove(rightClickMesh);
  rightClickMesh = null;
  elContextmenu.classList.remove("show");
});

// 改变点光强度时
document.querySelector("#lightPower").addEventListener("input", (e) => {
  pointLight.power = parseFloat(e.target.value) * Math.PI;
});
// 改变环境光强度时
document.querySelector("#ambientColor").addEventListener("input", (e) => {
  let value = parseInt(e.target.value);
  ambientLight.color.set(`rgb(${value},${value},${value})`);
});

// 获取url参数
function GetQueryString(name) {
  let reg = new RegExp("(^|&)" + name + "=([^&]*)(&|$)");
  let r = window.location.search.substr(1).match(reg);
  if (r != null) return unescape(r[2]);
  return null;
}
// 对象转Url参数
function objectToUrlParams(data) {
  let _result = [];
  for (let key in data) {
    let value = data[key];
    if (value.constructor == Array) {
      value.forEach(function (_value) {
        _result.push(key + "=" + _value);
      });
    } else {
      _result.push(key + "=" + value);
    }
  }
  return _result.join("&");
}
