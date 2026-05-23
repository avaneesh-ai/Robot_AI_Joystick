const ownerAccess = {
  email: "owner@robot.local",
  password: "Owner@12345",
};

const storageKeys = {
  pendingUser: "robot-ai-pending-user",
  activeUser: "robot-ai-active-user",
  admin: "robot-ai-admin-account",
  users: "robot-ai-users",
  theme: "robot-ai-theme",
};

const projectConfigs = {
  boat: {
    label: "Boat",
    title: "Boat controls",
    buttons: {
      forward: "Forward",
      backward: "Backward",
      left: "Left",
      right: "Right",
      stop: "Stop",
    },
    commands: {
      forward: "Move boat forward",
      backward: "Move boat backward",
      left: "Turn boat left",
      right: "Turn boat right",
      stop: "Stop boat",
    },
  },
  drone: {
    label: "Drone toy",
    title: "Drone toy controls",
    buttons: {
      forward: "Forward",
      backward: "Backward",
      left: "Left",
      right: "Right",
      stop: "Hover",
      up: "Up",
      down: "Down",
    },
    commands: {
      forward: "Fly forward",
      backward: "Fly backward",
      left: "Move left",
      right: "Move right",
      stop: "Hover / stop",
      up: "Increase altitude",
      down: "Decrease altitude",
    },
  },
  rover: {
    label: "Robot car",
    title: "Robot car controls",
    buttons: {
      forward: "Forward",
      backward: "Reverse",
      left: "Left",
      right: "Right",
      stop: "Stop",
    },
    commands: {
      forward: "Drive forward",
      backward: "Reverse",
      left: "Turn left",
      right: "Turn right",
      stop: "Stop robot car",
    },
  },
};

const controllerLabels = {
  esp32: "ESP32",
  arduino: "Arduino Uno / Nano",
  "raspberry-pi": "Raspberry Pi",
  microbit: "micro:bit",
  other: "Other microcontroller",
};

const screens = {
  credentials: document.querySelector("#credentials-screen"),
  adminSetup: document.querySelector("#admin-setup-screen"),
  profile: document.querySelector("#profile-screen"),
  emailSent: document.querySelector("#email-sent-screen"),
  confirm: document.querySelector("#confirm-screen"),
  setup: document.querySelector("#setup-screen"),
  app: document.querySelector("#app-screen"),
  adminUnlock: document.querySelector("#admin-unlock-screen"),
  admin: document.querySelector("#admin-screen"),
};

const credentialsForm = document.querySelector("#credentials-screen");
const adminSetupForm = document.querySelector("#admin-setup-screen");
const profileForm = document.querySelector("#profile-screen");
const setupForm = document.querySelector("#setup-screen");
const adminUnlockForm = document.querySelector("#admin-unlock-screen");
const credentialsError = document.querySelector("#credentials-error");
const adminSetupError = document.querySelector("#admin-setup-error");
const profileError = document.querySelector("#profile-error");
const setupError = document.querySelector("#setup-error");
const adminUnlockError = document.querySelector("#admin-unlock-error");
const sentEmail = document.querySelector("#sent-email");
const confirmEmail = document.querySelector("#confirm-email");
const verificationLink = document.querySelector("#verification-link");
const connectionStatus = document.querySelector("#connection-status");
const controlTitle = document.querySelector("#control-title");
const projectSummary = document.querySelector("#project-summary");
const deviceSummary = document.querySelector("#device-summary");
const commandStatus = document.querySelector("#command-status");
const statusProject = document.querySelector("#status-project");
const statusDevice = document.querySelector("#status-device");
const extraControls = document.querySelector("#extra-controls");
const controlSurface = document.querySelector(".control-surface");
const adminUsers = document.querySelector("#admin-users");
const openAdminButton = document.querySelector("#open-admin");
const installButton = document.querySelector("#install-app");
const themeToggle = document.querySelector("#theme-toggle");
const authModeNote = document.querySelector("#auth-mode-note");
const authSubmitButton = document.querySelector("#auth-submit");
const switchAuthModeButton = document.querySelector("#switch-auth-mode");
const openAdminSetupButton = document.querySelector("#open-admin-setup");
const credentialsFields = credentialsForm.elements;
const adminSetupFields = adminSetupForm.elements;
const profileFields = profileForm.elements;
const setupFields = setupForm.elements;
const adminUnlockFields = adminUnlockForm.elements;

let currentUser = null;
let draftUser = {};
let verificationToken = "";
let authMode = "login";
let activeScreenName = "credentials";
let activeProjectType = "boat";
let deviceVerified = false;
let deviceConnection = null;
let serialPort = null;
let serialEventsRegistered = false;
let deferredInstallPrompt = null;

function readSavedTheme() {
  try {
    const cookieTheme = document.cookie
      .split("; ")
      .find((item) => item.startsWith(`${storageKeys.theme}=`))
      ?.split("=")[1];

    return localStorage.getItem(storageKeys.theme) || cookieTheme;
  } catch {
    return document.documentElement.dataset.theme;
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(storageKeys.theme, theme);
  } catch {}

  document.cookie = `${storageKeys.theme}=${theme}; max-age=31536000; path=/; SameSite=Lax`;
}

function setTheme(theme) {
  const safeTheme = theme === "night" ? "night" : "light";
  document.documentElement.dataset.theme = safeTheme;
  saveTheme(safeTheme);
  themeToggle.textContent = safeTheme === "night" ? "L" : "N";
  themeToggle.setAttribute(
    "aria-label",
    safeTheme === "night" ? "Switch to light mode" : "Switch to night mode",
  );
  themeToggle.title = safeTheme === "night" ? "Light mode" : "Night mode";
  themeToggle.setAttribute("aria-pressed", String(safeTheme === "night"));
  document.querySelector('meta[name="theme-color"]').setAttribute(
    "content",
    safeTheme === "night" ? "#0d1b22" : "#edf7fb",
  );
}

function toggleTheme() {
  const currentTheme = document.documentElement.dataset.theme === "night" ? "night" : "light";
  setTheme(currentTheme === "night" ? "light" : "night");
}

function isLaptopOrDesktop() {
  const mobileDevice = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);

  return !mobileDevice;
}

function updateDeviceGate() {
  const desktopAllowed = isLaptopOrDesktop();
  document.body.classList.toggle("unsupported-device", !desktopAllowed);
  updateInstallButton();
}

function updateInstallButton() {
  const installAllowedScreens = ["setup", "app", "admin"];
  const desktopAllowed = isLaptopOrDesktop();

  if (!desktopAllowed || !deferredInstallPrompt || !installAllowedScreens.includes(activeScreenName)) {
    installButton.hidden = true;
    return;
  }

  installButton.hidden = false;
}

function registerInstallSupport() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./assets/sw.js").catch(() => {});
    });
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    updateDeviceGate();
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });
}

function showScreen(screenName) {
  activeScreenName = screenName;
  Object.values(screens).forEach((screen) => {
    screen.classList.remove("active");
  });

  screens[screenName].classList.add("active");
  updateInstallButton();
}

function readStoredUser(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

function readUsers() {
  const users = readStoredUser(storageKeys.users);
  return Array.isArray(users) ? users : [];
}

function readAdminAccount() {
  return readStoredUser(storageKeys.admin);
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function normalizeMobile(mobile) {
  return mobile.replace(/\D/g, "");
}

function normalizeUsername(username) {
  return username.trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email));
}

function findUserByIdentifier(identifier) {
  const normalizedEmail = normalizeEmail(identifier);
  const normalizedMobile = normalizeMobile(identifier);

  return readUsers().find((user) => {
    return (
      normalizeEmail(user.email || "") === normalizedEmail ||
      (normalizedMobile.length > 0 && normalizeMobile(user.mobile || "") === normalizedMobile)
    );
  });
}

function hashPassword(email, password) {
  const input = `${normalizeEmail(email)}:${password}`;
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `demo-${(hash >>> 0).toString(36)}`;
}

function hashAdminAccess(username, password) {
  return hashPassword(normalizeUsername(username), password);
}

function saveUser(key, user) {
  localStorage.setItem(key, JSON.stringify(user));
}

function saveUsers(users) {
  localStorage.setItem(storageKeys.users, JSON.stringify(users));
}

function saveAdminAccount(adminAccount) {
  localStorage.setItem(storageKeys.admin, JSON.stringify(adminAccount));
}

function getVerificationTokenFromUrl() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hashParams.get("verify");
}

function buildVerificationUrl(token) {
  const url = new URL(window.location.href);
  url.hash = `verify=${encodeURIComponent(token)}`;
  return url.toString();
}

function clearVerificationHash() {
  const url = new URL(window.location.href);
  url.hash = "";
  window.history.replaceState({}, document.title, url.toString());
}

function createToken() {
  const randomValues = new Uint32Array(3);
  crypto.getRandomValues(randomValues);
  return Array.from(randomValues, (value) => value.toString(36)).join("");
}

function isValidMobile(mobile) {
  return /^[6-9]\d{9}$/.test(mobile.replace(/\D/g, ""));
}

function setAuthMode(mode) {
  authMode = mode === "create" ? "create" : "login";
  const createMode = authMode === "create";

  authModeNote.textContent = createMode
    ? "Create your account with an email ID first. After email verification, you can open the joystick setup."
    : "Login with a registered email or mobile number. New users must create an account first.";
  authSubmitButton.textContent = createMode ? "Create account" : "Login";
  switchAuthModeButton.textContent = createMode ? "Back to login" : "Create account";
  credentialsError.textContent = "";
}

function getMatchingAdmin(identifier, password) {
  const adminAccount = readAdminAccount();
  const normalizedIdentifier = normalizeEmail(identifier);
  const normalizedMobile = normalizeMobile(identifier);

  if (
    adminAccount &&
    (normalizeEmail(adminAccount.email || "") === normalizedIdentifier ||
      (normalizedMobile.length > 0 && normalizeMobile(adminAccount.mobile || "") === normalizedMobile)) &&
    adminAccount.passwordHash === hashPassword(adminAccount.email, password)
  ) {
    return adminAccount;
  }

  if (normalizedIdentifier === ownerAccess.email && password === ownerAccess.password) {
    return {
      email: ownerAccess.email,
      mobile: "",
      name: "Owner",
    };
  }

  return null;
}

function canUnlockAdmin(username, password) {
  const adminAccount = readAdminAccount();

  if (
    adminAccount?.username &&
    normalizeUsername(adminAccount.username) === normalizeUsername(username) &&
    adminAccount.adminAccessHash === hashAdminAccess(username, password)
  ) {
    return true;
  }

  return normalizeUsername(username) === "owner" && password === ownerAccess.password;
}

function stripPrivateSessionFields(user) {
  const { token, password, ...safeUser } = user;
  return safeUser;
}

function upsertUser(user) {
  if (user.role === "owner") {
    return user;
  }

  const users = readUsers();
  const existingIndex = users.findIndex((savedUser) => savedUser.email === user.email);
  const existingUser = existingIndex >= 0 ? users[existingIndex] : {};
  const savedUser = {
    ...existingUser,
    ...stripPrivateSessionFields(user),
    createdAt: existingUser.createdAt || new Date().toISOString(),
    lastLoginAt: user.lastLoginAt || existingUser.lastLoginAt || new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    users[existingIndex] = savedUser;
  } else {
    users.push(savedUser);
  }

  saveUsers(users);
  return savedUser;
}

function updateActiveUser(updates) {
  currentUser = {
    ...currentUser,
    ...updates,
  };
  saveUser(storageKeys.activeUser, currentUser);

  if (currentUser.role === "owner") {
    const adminAccount = readAdminAccount();
    if (adminAccount) {
      saveAdminAccount({
        ...adminAccount,
        projectSetup: currentUser.projectSetup,
        lastLoginAt: currentUser.lastLoginAt,
        updatedAt: new Date().toISOString(),
      });
    }
    return;
  }

  upsertUser(currentUser);
}

function resetForms() {
  credentialsForm.reset();
  adminSetupForm.reset();
  adminUnlockForm.reset();
  profileForm.reset();
  setupForm.reset();
  setAuthMode("login");
  setProjectType("boat");
  deviceVerified = false;
  deviceConnection = null;
  connectionStatus.textContent = "Select the board used in your project before opening controls.";
}

function enterApp(user) {
  currentUser = upsertUser({
    ...stripPrivateSessionFields(user),
    lastLoginAt: new Date().toISOString(),
  });
  saveUser(storageKeys.activeUser, currentUser);
  localStorage.removeItem(storageKeys.pendingUser);
  clearVerificationHash();

  if (currentUser.role === "owner") {
    if (currentUser.projectSetup) {
      renderControls();
      showScreen("app");
      return;
    }

    showSetupScreen();
    return;
  }

  if (currentUser.projectSetup) {
    renderControls();
    showScreen("app");
    return;
  }

  showSetupScreen();
}

function enterOwnerAdmin(adminAccount = {}) {
  currentUser = {
    email: adminAccount.email || ownerAccess.email,
    name: adminAccount.name || "Owner",
    mobile: adminAccount.mobile || "",
    role: "owner",
    projectSetup: adminAccount.projectSetup || null,
    lastLoginAt: new Date().toISOString(),
  };
  saveUser(storageKeys.activeUser, currentUser);

  if (currentUser.projectSetup) {
    renderControls();
    showScreen("app");
    return;
  }

  showSetupScreen();
}

function showSetupScreen() {
  setupError.textContent = "";
  openAdminButton.hidden = currentUser?.role !== "owner";

  if (currentUser?.projectSetup) {
    const { projectType, projectName, controllerType, connection } = currentUser.projectSetup;
    setProjectType(projectType || "boat");
    setupFields.projectName.value = projectName || "";
    setupFields.controllerType.value = controllerType || "";
    deviceVerified = Boolean(connection?.verified);
    deviceConnection = connection || null;
    updateConnectionStatus();
  } else {
    setProjectType("boat");
    deviceVerified = false;
    deviceConnection = null;
    connectionStatus.textContent = "Select the board used in your project before opening controls.";
  }

  showScreen("setup");
}

function showVerificationPrompt(token) {
  const pendingUser = readStoredUser(storageKeys.pendingUser);

  if (!pendingUser || pendingUser.token !== token) {
    showScreen("credentials");
    credentialsError.textContent = "This login link is not valid anymore.";
    return;
  }

  confirmEmail.textContent = pendingUser.email;
  showScreen("confirm");
}

function setProjectType(projectType) {
  activeProjectType = projectConfigs[projectType] ? projectType : "boat";

  document.querySelectorAll(".project-tab").forEach((tab) => {
    const isActive = tab.dataset.projectType === activeProjectType;
    tab.classList.toggle("active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
}

function selectedControllerLabel() {
  return controllerLabels[setupFields.controllerType.value] || "controller";
}

function updateConnectionStatus() {
  if (!setupFields.controllerType.value) {
    connectionStatus.textContent = "Select ESP32, Arduino, Raspberry Pi, or another board.";
    return;
  }

  const controller = selectedControllerLabel();

  if (deviceConnection?.connected) {
    connectionStatus.textContent = `${controller} verified through ${deviceConnection.method}.`;
    return;
  }

  if (deviceVerified) {
    connectionStatus.textContent = `${controller} verified manually. You can open the joystick now.`;
    return;
  }

  connectionStatus.textContent = `${controller} selected. Verify it before opening controls.`;
}

function markDeviceConnected(method = "USB serial") {
  deviceVerified = true;
  deviceConnection = {
    method,
    connected: true,
    verified: true,
    verifiedAt: new Date().toISOString(),
  };

  if (currentUser?.projectSetup) {
    updateActiveUser({
      projectSetup: {
        ...currentUser.projectSetup,
        connection: deviceConnection,
      },
    });
    deviceSummary.textContent = `Device: ${controllerLabels[currentUser.projectSetup.controllerType] || currentUser.projectSetup.controllerType} connected`;
  }
}

async function openSerialPort(port, method = "USB serial") {
  serialPort = port;

  if (!serialPort.writable) {
    await serialPort.open({ baudRate: 115200 });
  }

  markDeviceConnected(method);
  updateConnectionStatus();
  return true;
}

async function connectToAuthorizedSerialPort() {
  if (!("serial" in navigator)) {
    return false;
  }

  const ports = await navigator.serial.getPorts();

  for (const port of ports) {
    try {
      await openSerialPort(port, "remembered USB serial");
      if (commandStatus) {
        commandStatus.textContent = "Device connected automatically. Joystick is ready.";
      }
      return true;
    } catch {}
  }

  return false;
}

function registerSerialEvents() {
  if (serialEventsRegistered || !("serial" in navigator)) {
    return;
  }

  serialEventsRegistered = true;
  navigator.serial.addEventListener("connect", () => {
    connectToAuthorizedSerialPort().catch(() => {});
  });
  navigator.serial.addEventListener("disconnect", (event) => {
    if (event.target === serialPort) {
      serialPort = null;
      if (commandStatus) {
        commandStatus.textContent = "Device disconnected. Reconnect it or use Verify device.";
      }
    }
  });
}

async function verifyDevice({ requestSerial = true } = {}) {
  setupError.textContent = "";

  if (!setupFields.controllerType.value) {
    setupError.textContent = "Please select the microcontroller or computer first.";
    return false;
  }

  const controller = selectedControllerLabel();

  if (requestSerial && "serial" in navigator) {
    try {
      const port = await navigator.serial.requestPort();
      await openSerialPort(port, "USB serial");
      return true;
    } catch (error) {
      deviceVerified = true;
      deviceConnection = {
        method: "manual selection",
        connected: false,
        verified: true,
        verifiedAt: new Date().toISOString(),
      };
      connectionStatus.textContent = `${controller} verified from your selection. USB permission was not completed.`;
      return true;
    }
  }

  deviceVerified = true;
  deviceConnection = {
    method: "manual selection",
    connected: false,
    verified: true,
    verifiedAt: new Date().toISOString(),
  };
  updateConnectionStatus();
  return true;
}

function renderControls() {
  const setup = currentUser.projectSetup;
  const config = projectConfigs[setup.projectType] || projectConfigs.boat;
  const buttons = config.buttons;

  openAdminButton.hidden = currentUser.role !== "owner";
  controlTitle.textContent = config.title;
  projectSummary.textContent = `Project: ${setup.projectName}`;
  deviceSummary.textContent = `Device: ${controllerLabels[setup.controllerType] || setup.controllerType}`;
  statusProject.textContent = config.label;
  statusDevice.textContent = controllerLabels[setup.controllerType] || "Controller";
  extraControls.hidden = setup.projectType !== "drone";
  commandStatus.textContent = "Last command: Stop";
  controlSurface.dataset.activeCommand = "stop";
  connectToAuthorizedSerialPort().catch(() => {});

  document.querySelectorAll("[data-command]").forEach((button) => {
    const command = button.dataset.command;
    const label = buttons[command];

    if (label) {
      button.textContent = label;
      button.hidden = false;
    } else {
      button.hidden = true;
    }
  });
}

function animateJoystick(command) {
  controlSurface.dataset.activeCommand = command;

  if (command !== "stop") {
    window.setTimeout(() => {
      if (controlSurface.dataset.activeCommand === command) {
        controlSurface.dataset.activeCommand = "stop";
      }
    }, 420);
  }
}

async function sendCommandToDevice(command) {
  if (!serialPort?.writable) {
    return false;
  }

  const writer = serialPort.writable.getWriter();
  const payload = new TextEncoder().encode(`${command}\n`);

  try {
    await writer.write(payload);
    return true;
  } finally {
    writer.releaseLock();
  }
}

async function handleCommand(command) {
  const setup = currentUser?.projectSetup;

  if (!setup) {
    return;
  }

  const config = projectConfigs[setup.projectType] || projectConfigs.boat;
  const label = config.commands[command] || command;
  animateJoystick(command);
  const commandSent = await sendCommandToDevice(command).catch(() => false);
  const delivery = commandSent ? "Sent to device" : "Ready to send when firmware is connected";

  commandStatus.textContent = `Last command: ${label}. ${delivery}.`;
  updateActiveUser({
    lastCommand: label,
    lastCommandAt: new Date().toISOString(),
  });
}

function formatDate(value) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function renderAdmin() {
  const users = readUsers();

  if (!users.length) {
    adminUsers.innerHTML = '<p class="empty-state">No user details have been saved yet.</p>';
    return;
  }

  adminUsers.innerHTML = users
    .map((user) => {
      const setup = user.projectSetup || {};
      const project = projectConfigs[setup.projectType]?.label || "Not selected";
      const controller = controllerLabels[setup.controllerType] || "Not selected";

      return `
        <article class="admin-user">
          <div>
            <span>Name</span>
            <strong>${escapeHtml(user.name || "Unknown")}</strong>
          </div>
          <div>
            <span>Email</span>
            <strong>${escapeHtml(user.email || "Not recorded")}</strong>
          </div>
          <div>
            <span>Mobile</span>
            <strong>${escapeHtml(user.mobile || "Not recorded")}</strong>
          </div>
          <div>
            <span>Project</span>
            <strong>${escapeHtml(setup.projectName || project)}</strong>
          </div>
          <div>
            <span>Type</span>
            <strong>${escapeHtml(project)}</strong>
          </div>
          <div>
            <span>Controller</span>
            <strong>${escapeHtml(controller)}</strong>
          </div>
          <div>
            <span>Last login</span>
            <strong>${formatDate(user.lastLoginAt)}</strong>
          </div>
          <div>
            <span>Last command</span>
            <strong>${escapeHtml(user.lastCommand || "No command yet")}</strong>
          </div>
        </article>
      `;
    })
    .join("");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };

    return entities[character];
  });
}

function logout() {
  localStorage.removeItem(storageKeys.activeUser);
  currentUser = null;
  resetForms();
  showScreen("credentials");
  credentialsFields.email.focus();
}

credentialsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  credentialsError.textContent = "";

  const identifier = credentialsFields.email.value.trim();
  const email = normalizeEmail(identifier);
  const password = credentialsFields.password.value.trim();

  if (!identifier) {
    credentialsError.textContent = "Please enter a registered email ID or mobile number.";
    return;
  }

  const matchingAdmin = getMatchingAdmin(identifier, password);

  if (matchingAdmin) {
    enterOwnerAdmin(matchingAdmin);
    return;
  }

  const existingUser = findUserByIdentifier(identifier);

  if (authMode === "login") {
    if (!existingUser) {
      credentialsError.textContent = "No account found with this email or mobile number on this laptop.";
      return;
    }

    if (existingUser.passwordHash !== hashPassword(existingUser.email, password)) {
      credentialsError.textContent = "Incorrect password. Please enter the correct password.";
      return;
    }

    verificationToken = createToken();
    const pendingUser = {
      ...existingUser,
      token: verificationToken,
    };

    saveUser(storageKeys.pendingUser, pendingUser);
    sentEmail.textContent = pendingUser.email;
    verificationLink.href = buildVerificationUrl(verificationToken);
    showScreen("emailSent");
    return;
  }

  if (!isValidEmail(identifier)) {
    credentialsError.textContent = "Please enter a valid email ID to create an account.";
    return;
  }

  if (existingUser) {
    credentialsError.textContent = "This email already has an account. Please login with the correct password.";
    return;
  }

  if (password.length < 6) {
    credentialsError.textContent = "Password must be at least 6 characters.";
    return;
  }

  draftUser = {
    email,
    passwordHash: hashPassword(email, password),
  };
  showScreen("profile");
  profileFields.name.focus();
});

adminSetupForm.addEventListener("submit", (event) => {
  event.preventDefault();
  adminSetupError.textContent = "";

  const email = normalizeEmail(adminSetupFields.adminEmail.value);
  const mobile = normalizeMobile(adminSetupFields.adminMobile.value);
  const password = adminSetupFields.adminPassword.value.trim();
  const username = normalizeUsername(adminSetupFields.adminUsername.value);
  const accessPassword = adminSetupFields.adminAccessPassword.value.trim();
  const confirmPassword = adminSetupFields.adminConfirmPassword.value.trim();
  const setupKey = adminSetupFields.ownerSetupKey.value.trim();

  if (!isValidEmail(email)) {
    adminSetupError.textContent = "Please enter a valid admin email ID.";
    return;
  }

  if (!isValidMobile(mobile)) {
    adminSetupError.textContent = "Please enter a valid 10 digit admin mobile number.";
    return;
  }

  if (password.length < 8) {
    adminSetupError.textContent = "Normal app password must be at least 8 characters.";
    return;
  }

  if (username.length < 3) {
    adminSetupError.textContent = "Admin username must be at least 3 characters.";
    return;
  }

  if (accessPassword.length < 8) {
    adminSetupError.textContent = "Admin access password must be at least 8 characters.";
    return;
  }

  if (accessPassword !== confirmPassword) {
    adminSetupError.textContent = "Admin access passwords do not match.";
    return;
  }

  if (setupKey !== ownerAccess.password) {
    adminSetupError.textContent = "Owner setup key is incorrect.";
    return;
  }

  const adminAccount = {
    email,
    mobile,
    username,
    name: "Owner",
    passwordHash: hashPassword(email, password),
    adminAccessHash: hashAdminAccess(username, accessPassword),
    updatedAt: new Date().toISOString(),
  };

  saveAdminAccount(adminAccount);
  adminSetupForm.reset();
  credentialsFields.email.value = email;
  credentialsFields.password.value = "";
  setAuthMode("login");
  credentialsError.textContent = "Admin setup saved. Login normally, then use Admin with your username and admin password.";
  showScreen("credentials");
});

profileForm.addEventListener("submit", (event) => {
  event.preventDefault();
  profileError.textContent = "";

  const name = profileFields.name.value.trim();
  const mobile = profileFields.mobile.value.trim();

  if (name.length < 2) {
    profileError.textContent = "Please enter your name.";
    return;
  }

  if (!isValidMobile(mobile)) {
    profileError.textContent = "Please enter a valid 10 digit mobile number.";
    return;
  }

  const mobileAlreadyUsed = readUsers().some((user) => normalizeMobile(user.mobile || "") === normalizeMobile(mobile));

  if (mobileAlreadyUsed) {
    profileError.textContent = "This mobile number already has an account on this laptop.";
    return;
  }

  verificationToken = createToken();
  const pendingUser = {
    ...draftUser,
    name,
    mobile: mobile.replace(/\D/g, ""),
    role: "user",
    token: verificationToken,
  };

  saveUser(storageKeys.pendingUser, pendingUser);
  sentEmail.textContent = pendingUser.email;
  verificationLink.href = buildVerificationUrl(verificationToken);
  showScreen("emailSent");
});

setupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setupError.textContent = "";

  const projectName = setupFields.projectName.value.trim();
  const controllerType = setupFields.controllerType.value;

  if (projectName.length < 2) {
    setupError.textContent = "Please enter the project name.";
    return;
  }

  if (!controllerType) {
    setupError.textContent = "Please select the microcontroller or computer.";
    return;
  }

  if (!deviceVerified && !(await verifyDevice({ requestSerial: false }))) {
    return;
  }

  updateActiveUser({
    projectSetup: {
      projectName,
      projectType: activeProjectType,
      controllerType,
      connection: deviceConnection || {
        method: "manual selection",
        connected: false,
        verified: true,
        verifiedAt: new Date().toISOString(),
      },
    },
  });
  renderControls();
  showScreen("app");
});

document.querySelectorAll(".project-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    setProjectType(tab.dataset.projectType);
  });
});

setupFields.controllerType.addEventListener("change", () => {
  deviceVerified = false;
  deviceConnection = null;
  updateConnectionStatus();
});

document.querySelector("#connect-device").addEventListener("click", () => {
  verifyDevice({ requestSerial: true });
});

switchAuthModeButton.addEventListener("click", () => {
  setAuthMode(authMode === "login" ? "create" : "login");
});

openAdminSetupButton.addEventListener("click", () => {
  credentialsError.textContent = "";
  adminSetupError.textContent = "";
  adminSetupForm.reset();
  showScreen("adminSetup");
  adminSetupFields.adminEmail.focus();
});

document.querySelector("#back-from-admin-setup").addEventListener("click", () => {
  adminSetupError.textContent = "";
  showScreen("credentials");
});

document.querySelector("#back-to-credentials").addEventListener("click", () => {
  showScreen("credentials");
});

document.querySelector("#restart-flow").addEventListener("click", () => {
  localStorage.removeItem(storageKeys.pendingUser);
  draftUser = {};
  verificationToken = "";
  resetForms();
  showScreen("credentials");
  credentialsFields.email.focus();
});

document.querySelector("#cancel-login").addEventListener("click", () => {
  clearVerificationHash();
  showScreen("credentials");
});

document.querySelector("#accept-login").addEventListener("click", () => {
  const pendingUser = readStoredUser(storageKeys.pendingUser);

  if (pendingUser) {
    enterApp(pendingUser);
  }
});

document.querySelector("#change-setup").addEventListener("click", showSetupScreen);
document.querySelector("#logout").addEventListener("click", logout);
document.querySelector("#setup-logout").addEventListener("click", logout);
document.querySelector("#admin-logout").addEventListener("click", logout);

document.querySelector("#open-admin").addEventListener("click", () => {
  adminUnlockError.textContent = "";
  adminUnlockForm.reset();
  showScreen("adminUnlock");
  adminUnlockFields.adminLoginUsername.focus();
});

adminUnlockForm.addEventListener("submit", (event) => {
  event.preventDefault();
  adminUnlockError.textContent = "";

  if (currentUser?.role !== "owner") {
    adminUnlockError.textContent = "Admin access is only available for the admin account on this laptop.";
    return;
  }

  const username = adminUnlockFields.adminLoginUsername.value.trim();
  const password = adminUnlockFields.adminLoginPassword.value.trim();

  if (!canUnlockAdmin(username, password)) {
    adminUnlockError.textContent = "Incorrect admin username or password.";
    return;
  }

  renderAdmin();
  showScreen("admin");
});

document.querySelector("#back-from-admin-unlock").addEventListener("click", () => {
  adminUnlockError.textContent = "";

  if (currentUser?.projectSetup) {
    renderControls();
    showScreen("app");
    return;
  }

  showSetupScreen();
});

document.querySelector("#back-to-app").addEventListener("click", () => {
  if (currentUser?.role === "owner") {
    if (currentUser.projectSetup) {
      renderControls();
      showScreen("app");
      return;
    }

    showSetupScreen();
    return;
  }

  renderControls();
  showScreen("app");
});

document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => {
    handleCommand(button.dataset.command);
  });
});

installButton.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(() => {});
  deferredInstallPrompt = null;
  installButton.hidden = true;
});

themeToggle.addEventListener("click", toggleTheme);
window.addEventListener("resize", updateDeviceGate);
window.addEventListener("orientationchange", updateDeviceGate);
window.addEventListener("hashchange", () => {
  const token = getVerificationTokenFromUrl();

  if (token) {
    showVerificationPrompt(token);
  }
});

registerInstallSupport();
registerSerialEvents();
setTheme(readSavedTheme() || document.documentElement.dataset.theme || "light");
updateDeviceGate();

const activeUser = readStoredUser(storageKeys.activeUser);
const tokenFromUrl = getVerificationTokenFromUrl();

if (tokenFromUrl) {
  showVerificationPrompt(tokenFromUrl);
} else if (activeUser?.role === "owner") {
  currentUser = activeUser;
  if (currentUser.projectSetup) {
    renderControls();
    showScreen("app");
  } else {
    showSetupScreen();
  }
} else if (activeUser) {
  currentUser = activeUser;
  if (currentUser.projectSetup) {
    renderControls();
    showScreen("app");
  } else {
    showSetupScreen();
  }
} else {
  showScreen("credentials");
}
