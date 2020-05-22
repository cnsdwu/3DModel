// 数据
let data = {};

// 存储事件
let eventArr = [];
// 为three添加事件支持
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
// 移除事件支持
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

// 遍历获取组或mesh里的Mesh
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
  group; // 分组
let flagAnimation = false; // 标记是否包含动画
let flagAutorotate = true; // 标记是否自动旋转
let flagBtnAutorotate = true; // 标记自动旋转按钮状态
let flagBtnMusic = true; // 标记背景音乐按钮状态
let clock = new THREE.Clock(); // 时钟 用于动画
let raycaster = new THREE.Raycaster(); // 射线 用于检测事件
let elMouseTips = document.querySelector("#mouseTips"); //页面提示元素
let timerAutorotate = null; // 自动旋转时间
let elBgMusic = document.querySelector("#bgMusic"); // 背景音乐元素

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
  // 设置显示外链
  data.link && document.querySelector("#btnLink").classList.add("show");
  // 设置显示购买
  data.buy_link && document.querySelector("#btnBuy").classList.add("show");
  // 设置背景音乐
  if (data.music && data.music.match(/\.\S{1,4}$/i)) {
    elBgMusic.src = data.music;
    document.querySelector("#btnBgMusic").classList.add("show");
    elBgMusic.load();
  }
  // 设置咨询
  if (data.consulting_flag == 1) {
    document.querySelector("#btnAdvisory").classList.add("show");
    document.querySelector(".orderTit").innerHTML = data.rname;
  }

  // 创建div 并添加加到页面中
  container = document.createElement("div");
  document.body.appendChild(container);

  // 相机
  camera = new THREE.PerspectiveCamera(
    30, // fov
    window.innerWidth / window.innerHeight,
    1,
    2000 //可显示的范围
  );
  // 设置初使相机的位置
  // camera.position.set(20, 20, 20);
  camera.position.set(
    parseFloat(data.camera_position_x),
    parseFloat(data.camera_position_y),
    parseFloat(data.camera_position_z)
  );

  // 创建场景
  scene = new THREE.Scene();
  // 组
  group = new THREE.Group();
  scene.add(group); // 将组添加到场景中

  // 光源
  // 环境光
  ambientLight = new THREE.AmbientLight(
    `rgb(${parseInt(data.ambient_light_color)},${parseInt(
      data.ambient_light_color
    )},${data.ambient_light_color})`
  );
  scene.add(ambientLight); //环境光对象添加到scene场景中
  //点光源
  pointLight = new THREE.PointLight(0xffffff);
  pointLight.power = parseFloat(data.point_light_power) * Math.PI; // 光强 默认4PI
  //设置点光源位置，改变光源的位置
  // pointLight.position.set(400, 200, 300);
  pointLight.position.copy(camera.position);
  scene.add(pointLight);

  // 加载模型
  let loader = new THREE.FBXLoader(); //创建一个FBX加载器
  loader.load(data.fbx, function (object) {
    if (object.animations.length > 0) {
      // 有动画时
      flagAnimation = true; // 标记为有动画
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
    // 将所有对象设置可反射光
    object.children.forEach(function (child) {
      if (child.material) child.material.shininess = 8;
    });

    group.add(object);
    document.querySelector("#ajaxloading").classList.add("hide");
  });

  // 处理热点数据
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
      group.add(mesh); //网格模型添加到场景中
      mesh.addEvent("click", (event, info) => {
        showModalMask(item.title, item.html);
      });
      mesh.addEvent("touchstart", (event, info) => {
        mesh.userData.touchstart = new Date().getTime();
      });
      mesh.addEvent("touchend", (event, info) => {
        if (
          mesh.userData.touchstart &&
          (new Date().getTime() - mesh.userData.touchstart < 200)
        )
          showModalMask(item.title, item.html);
      });
      // 移动事件，显示tips
      mesh.addEvent(
        "mousemove",
        (event, info) => {
          elMouseTips.innerHTML = item.title;
          elMouseTips.style.left = event.pageX + "px";
          elMouseTips.style.top = event.pageY + "px";
          elMouseTips.classList.add("show");
        },
        () => {
          elMouseTips.classList.remove("show");
        }
      );
    }
  }

  // 渲染
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio); // 比例
  renderer.setSize(window.innerWidth, window.innerHeight); // 大小
  renderer.shadowMap.enabled = true; // 阴影
  container.appendChild(renderer.domElement); // 添加到容器

  // 控制
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  //设置相机距离原点的最远距离
  // controls.minDistance  = 10;
  //设置相机距离原点的最远距离
  // controls.maxDistance  = 200;
  controls.enableDamping = true; // 阻尼
  controls.target.set(
    parseFloat(data.controls_position_x),
    parseFloat(data.controls_position_y),
    parseFloat(data.controls_position_z)
  );
  controls.update();

  window.addEventListener("resize", onWindowResize, false);
  window.addEventListener("mousemove", onEvent, false);
  window.addEventListener("click", onEvent, false);
  window.addEventListener("touchstart", onEvent, false);
  window.addEventListener("touchend", onEvent, false);
  window.addEventListener("mouseover", onEvent, false);
}

// 调整窗口大小时
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
}

// 以设备刷新率执行
function animate() {
  pointLight.position.copy(camera.position); // 光源跟随相机
  if (flagAnimation) {
    // 有动画时
    let delta = clock.getDelta();

    if (mixer) mixer.update(delta);
  }

  // 自动旋转
  if (flagAutorotate && flagBtnAutorotate) {
    group.rotation.y += 0.001;
  }
  controls.update();
  renderer.render(scene, camera);

  // stats.update();
  requestAnimationFrame(animate);
}

function onEvent(event) {
  if (event.type == "click" && flagBtnAutorotate) {
    flagAutorotate = false; // 停止自动
    clearTimeout(timerAutorotate);
    timerAutorotate = setTimeout(() => {
      flagAutorotate = true;
    }, 5000);
  }

  for (let item of eventArr) {
    if (event.type == item.type) {
      let mouse = new THREE.Vector2(1, 1);
      if (event.changedTouches && event.changedTouches.length == 1) {
        mouse.x = (event.changedTouches[0].pageX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.changedTouches[0].pageY / window.innerHeight) * 2 + 1;
      } else {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
      }
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

// 页面相关
//   点击自动旋转
document
  .querySelector("#autoRotate")
  .addEventListener("click", function (event) {
    if (flagBtnAutorotate) {
      this.querySelector(".icon").src = "images/btn-ani-pause.png";
      flagBtnAutorotate = false;
      flagAutorotate = false;
    } else {
      this.querySelector(".icon").src = "images/btn-ani-play.png";
      flagBtnAutorotate = true;
      flagAutorotate = true;
    }
    event.stopPropagation();
  });
//   点击背景音乐
document.querySelector("#btnBgMusic").addEventListener("click", function () {
  if (elBgMusic.paused) {
    this.querySelector(".icon").src = "images/btn-music-on.png";
    elBgMusic.load();
  } else {
    this.querySelector(".icon").src = "images/btn-music-off.png";
    elBgMusic.pause();
  }
});
// 点击外链
document.querySelector("#btnLink").addEventListener("click", function () {
  window.open(data.link, "_blank");
});
// 点击购买
document.querySelector("#btnBuy").addEventListener("click", function () {
  window.open(data.buy_link, "_blank");
});
// 点击咨询按钮
document.querySelector("#btnAdvisory").addEventListener("click", function () {
  document.querySelector("#productMask").style.display = "block";
});
// 点击关闭咨询
document
  .querySelector("#closeProductMask")
  .addEventListener("click", function (event) {
    event.stopPropagation();
    document.querySelector("#productMask").style.display = "none";
  });
// 点击关闭图文
document
  .querySelector("#closeModalMask")
  .addEventListener("click", function (event) {
    event.stopPropagation();
    document.querySelector("#modalMask").style.display = "none";
  });

// 点击提交咨询
function orderSubmit() {
  let elOrder = document.querySelector(".advisoryBox");
  let elName = elOrder.querySelector("input[name=orderName]");
  let elTel = elOrder.querySelector("input[name=orderTel]");
  let elEmail = elOrder.querySelector("input[name=orderEmail]");
  let elProduct = elOrder.querySelector("input[name=orderProduct]");
  let elOther = elOrder.querySelector("textarea[name=orderOter]");
  let order_name = elName.value;
  let order_tel = elTel.value;
  let order_email = elEmail.value;
  let order_product = GetQueryString("id");
  let order_other = elOther.value;
  let tempEl = null;
  tempEl = document.querySelectorAll("li font");
  if (tempEl.length > 0) {
    for (let item of tempEl) item.remove();
  }
  if (order_name == "" || order_name == undefined || order_name.trim() == "") {
    tempEl = elName.nextElementSibling && tempEl.remove();
    elName.insertAdjacentHTML("afterend", "<font>姓名不能为空！</font>");
    return;
  }
  let nameLength = valLength(order_name);
  if (nameLength > 30) {
    tempEl = elName.nextElementSibling && tempEl.remove();
    elName.insertAdjacentHTML("afterend", "<font>请输入1-30个字符！</font>");
    return;
  }
  let isTel = telFormat(order_tel);
  if (!isTel) {
    tempEl = elTel.nextElementSibling && tempEl.remove();
    elTel.insertAdjacentHTML("afterend", "<font>电话号码格式不正确！</font>");
    return;
  }
  if (order_email == "" || order_email == undefined) {
    tempEl = elEmail.nextElementSibling && tempEl.remove();
    elEmail.insertAdjacentHTML("afterend", "<font>Email不能为空！</font>");
    return;
  }
  let isEmail = emailFormat(order_email);
  if (!isEmail) {
    tempEl = elEmail.nextElementSibling && tempEl.remove();
    elEmail.insertAdjacentHTML("afterend", "<font>Email格式不正确！</font>");
    return;
  }
  if (order_product == "" || order_product == undefined) {
    tempEl = elProduct.nextElementSibling && tempEl.remove();
    elProduct.insertAdjacentHTML("afterend", "<font>意向产品不能为空！</font>");
    return;
  }
  let otherLength = valLength(order_other);
  if (otherLength > 500) {
    tempEl = elOther.nextElementSibling && tempEl.remove();
    elOther.insertAdjacentHTML("afterend", "<font>请输入0-500个字符！</font>");
    return;
  }
  let orderData = {
    act: "add_consulting",
    name: order_name,
    tel: order_tel,
    email: order_email,
    production: order_product,
    content: order_other,
  };
  orderResult(orderData);
}
// 提交咨询数据到后台
function orderResult(result) {
  showLoading();
  fetch("/consulting.php", {
    method: "POST",
    body: objectToUrlParams(result),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    },
  })
    .then((res) => res.text())
    .then((res) => {
      if (res == "1") {
        // var tiphtml = "提交成功！";
        document.querySelector(".advisoryBox .orderResult-ok").style.display =
          "block";
        document.querySelector(".advisoryBox .form").style.display = "none";
        setTimeout(function () {
          closeProductMask();
          document.querySelector(".advisoryBox .orderResult-ok").style.display =
            "none";
          document.querySelector(".advisoryBox .form").style.display = "block";
        }, 2000);
      } else {
        // var tiphtml = "提交失败！",
        // tiphtml1 = "请返回>>";
        document.querySelector(
          ".advisoryBox .orderResult-error"
        ).style.display = "block";
        document.querySelector(".advisoryBox .form").style.display = "none";
      }
      hideLoading();
    });
}
//订购结果
function returnOrder() {
  document.querySelector(".advisoryBox .orderResult-error").style.display =
    "none";
  document.querySelector(".advisoryBox .form").style.display = "block";
}
// 关闭咨询框
function closeProductMask() {
  document.querySelector("#productMask").style.display = "none";
}
// 显示加载中..
function showLoading() {
  document.querySelector("#ajaxloading").style.display = "block";
}
// 隐藏加载中。。
function hideLoading() {
  document.querySelector("#ajaxloading").style.display = "none";
}
// 电话号码验证
function telFormat(str) {
  let format1 = /^[1][358]\d{9}$/; //手机
  let format2 = /^((\d{3,4})(-|\s)?)?(\d{3,8})((-|\s)?(\d{1,5}))?$/; //座机
  let result = format1.test(str) || format2.test(str);
  return result;
}
// 邮箱验证
function emailFormat(str) {
  let format = /^(\w)+(\.\w+)*@(\w)+((\.\w+)+)$/;
  let result = format.test(str);
  return result;
}
// 验证长度
function valLength(str) {
  let strlength = 0;
  for (i = 0; i < str.length; i++) {
    if (isChinese(str.charAt(i)) == true) {
      strlength = strlength + 2;
    } else {
      strlength = strlength + 1;
    }
  }
  return strlength;
}
// 验证是中文
function isChinese(str) {
  let format = /[u00-uFF]/;
  return !format.test(str);
}

// 关闭图文框
function closeModalMask() {
  document.querySelector("#modalMask").style.display = "none";
}
// 显示图文框
function showModalMask(title, html) {
  if (title) {
    document.querySelector("#modalTitle").innerHTML = title;
    document.querySelector("#modalBody").innerHTML = html;
  }
  if (html) {
    document.querySelector("#modalBody").innerHTML = html;
  }
  document.querySelector("#modalMask").style.display = "block";
}
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
