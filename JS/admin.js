// ==============================
// SUPABASE SETTINGS
// ==============================
// Replace these with your own Supabase project values.
// Use your public anon/publishable key.
// NEVER use your service_role key in frontend JavaScript.

const SUPABASE_URL = "https://dvjosisqpvopbxcglwhl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_0LJnUqBnCZohvWoIFn5NWA_B3UtoKFv";

let supabaseClient = null;

if (
  typeof supabase !== "undefined" &&
  SUPABASE_URL !== "YOUR_SUPABASE_PROJECT_URL" &&
  SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY"
) {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ==============================
// PAGE LOAD
// ==============================
document.addEventListener("DOMContentLoaded", async () => {
  const adminStatus = document.getElementById("admin-status");

  if (!supabaseClient) {
    adminStatus.textContent =
      "Supabase is not connected. Add your Supabase URL and anon key in JS/admin.js.";
    return;
  }

  setupEventListeners();
  await checkCurrentSession();
});

// ==============================
// EVENT LISTENERS
// ==============================
function setupEventListeners() {
  const loginForm = document.getElementById("login-form");
  const logoutButton = document.getElementById("logout-button");
  const projectForm = document.getElementById("project-form");
  const cancelEditButton = document.getElementById("cancel-edit-button");

  if (loginForm) {
    loginForm.addEventListener("submit", async event => {
      event.preventDefault();
      await loginAdmin();
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener("click", async () => {
      await supabaseClient.auth.signOut();
      showLogin("You have been logged out.");
    });
  }

  if (projectForm) {
    projectForm.addEventListener("submit", async event => {
      event.preventDefault();
      await saveProject();
    });
  }

  if (cancelEditButton) {
    cancelEditButton.addEventListener("click", () => {
      resetProjectForm();
    });
  }
}

// ==============================
// CHECK CURRENT SESSION
// ==============================
async function checkCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabaseClient.auth.getSession();

  if (error) {
    console.error("Session error:", error);
    showLogin("Could not check login session.");
    return;
  }

  if (!session) {
    showLogin();
    return;
  }

  const isAdmin = await verifyAdminUser();

  if (!isAdmin) {
    await supabaseClient.auth.signOut();
    showLogin("This account is not allowed to access the admin dashboard.");
    return;
  }

  await showDashboard();
}

// ==============================
// LOGIN ADMIN
// ==============================
async function loginAdmin() {
  const email = document.getElementById("admin-email").value.trim();
  const password = document.getElementById("admin-password").value;
  const adminStatus = document.getElementById("admin-status");

  adminStatus.textContent = "Logging in...";

  const { error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error("Login error:", error);
    adminStatus.textContent = "Login failed. Please check your email and password.";
    return;
  }

  const isAdmin = await verifyAdminUser();

  if (!isAdmin) {
    await supabaseClient.auth.signOut();
    showLogin("This account is not listed as an admin.");
    return;
  }

  const loginForm = document.getElementById("login-form");

  if (loginForm) {
    loginForm.reset();
  }

  await showDashboard();
}

// ==============================
// VERIFY ADMIN USER
// ==============================
async function verifyAdminUser() {
  const {
    data: { user },
    error: userError,
  } = await supabaseClient.auth.getUser();

  if (userError || !user) {
    console.error("User check error:", userError);
    return false;
  }

  const { data, error } = await supabaseClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Admin verification error:", error);
    return false;
  }

  return !!data;
}

// ==============================
// SHOW LOGIN
// ==============================
function showLogin(message = "Please log in to manage your projects.") {
  const loginSection = document.getElementById("login-section");
  const dashboardSection = document.getElementById("dashboard-section");
  const adminStatus = document.getElementById("admin-status");

  if (loginSection) {
    loginSection.style.display = "block";
  }

  if (dashboardSection) {
    dashboardSection.style.display = "none";
  }

  if (adminStatus) {
    adminStatus.textContent = message;
  }
}

// ==============================
// SHOW DASHBOARD
// ==============================
async function showDashboard() {
  const loginSection = document.getElementById("login-section");
  const dashboardSection = document.getElementById("dashboard-section");
  const adminStatus = document.getElementById("admin-status");

  if (loginSection) {
    loginSection.style.display = "none";
  }

  if (dashboardSection) {
    dashboardSection.style.display = "block";
  }

  if (adminStatus) {
    adminStatus.textContent = "You are logged in.";
  }

  await loadProjects();
  await setNextDisplayOrder();
}

// ==============================
// GET NEXT DISPLAY ORDER
// ==============================
async function getNextDisplayOrder() {
  const { data, error } = await supabaseClient
    .from("projects")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Could not get next display order:", error);
    return 1;
  }

  if (!data || data.length === 0) {
    return 1;
  }

  const highestDisplayOrder = Number(data[0].display_order) || 0;

  return highestDisplayOrder + 1;
}

// ==============================
// SET NEXT DISPLAY ORDER IN FORM
// ==============================
async function setNextDisplayOrder() {
  const displayOrderInput = document.getElementById("project-display-order");
  const projectIdInput = document.getElementById("project-id");

  if (!displayOrderInput) return;

  // Do not overwrite the display order while editing an existing project
  if (projectIdInput && projectIdInput.value) return;

  const nextDisplayOrder = await getNextDisplayOrder();

  displayOrderInput.value = nextDisplayOrder;
}

// ==============================
// SAVE PROJECT
// ==============================
async function saveProject() {
  const adminStatus = document.getElementById("admin-status");

  const projectId = document.getElementById("project-id").value;
  const title = document.getElementById("project-title").value.trim();
  const description = document.getElementById("project-description").value.trim();
  const technologiesInput = document.getElementById("project-technologies").value.trim();
  const liveUrl = document.getElementById("project-live-url").value.trim();
  const sourceUrl = document.getElementById("project-source-url").value.trim();
  const displayOrder = Number(document.getElementById("project-display-order").value);
  const isFeatured = document.getElementById("project-featured").checked;
  const isPublished = document.getElementById("project-published").checked;

  if (!title || !description || !technologiesInput) {
    adminStatus.textContent = "Please complete all required fields.";
    return;
  }

  const technologies = technologiesInput
    .split(",")
    .map(technology => technology.trim())
    .filter(Boolean);

  const links = [];

  if (liveUrl) {
    links.push({
      label: "View Website",
      url: liveUrl,
    });
  }

  if (sourceUrl) {
    links.push({
      label: "View Source Code",
      url: sourceUrl,
    });
  }

  const projectData = {
    title,
    description,
    technologies,
    links,
    display_order: displayOrder,
    is_featured: isFeatured,
    is_published: isPublished,
  };

  adminStatus.textContent = "Saving project...";

  let result;

  if (projectId) {
    result = await supabaseClient
      .from("projects")
      .update(projectData)
      .eq("id", projectId);
  } else {
    result = await supabaseClient
      .from("projects")
      .insert(projectData);
  }

  if (result.error) {
    console.error("Save project error:", result.error);
    adminStatus.textContent =
      "Failed to save project. Check your Supabase RLS policies.";
    return;
  }

  adminStatus.textContent = projectId
    ? "Project updated successfully."
    : "Project added successfully.";

  resetProjectForm();
  await loadProjects();
}

// ==============================
// LOAD PROJECTS
// ==============================
async function loadProjects() {
  const projectsList = document.getElementById("projects-list");
  const adminStatus = document.getElementById("admin-status");

  if (!projectsList) return;

  projectsList.innerHTML = "<p>Loading projects...</p>";

  const { data: projects, error } = await supabaseClient
    .from("projects")
    .select("*")
    .order("display_order", { ascending: true });

  if (error) {
    console.error("Load projects error:", error);
    projectsList.innerHTML = "<p>Failed to load projects.</p>";

    if (adminStatus) {
      adminStatus.textContent =
        "Could not load projects. Make sure your account exists in admin_users.";
    }

    return;
  }

  if (!projects || projects.length === 0) {
    projectsList.innerHTML = "<p>No projects added yet.</p>";
    return;
  }

  projectsList.innerHTML = "";

  projects.forEach(project => {
    const projectItem = document.createElement("article");
    projectItem.classList.add("project-admin-item");

    const title = document.createElement("h3");
    title.textContent = project.title;

    const description = document.createElement("p");
    description.textContent = project.description;

    const technologies = document.createElement("p");
    technologies.classList.add("project-tech");

    if (Array.isArray(project.technologies)) {
      technologies.textContent = `Technologies: ${project.technologies.join(", ")}`;
    } else {
      technologies.textContent = "Technologies: None listed";
    }

    const meta = document.createElement("p");
    meta.classList.add("project-meta");
    meta.textContent = `Order: ${project.display_order} | Published: ${
      project.is_published ? "Yes" : "No"
    } | Featured: ${project.is_featured ? "Yes" : "No"}`;

    const buttonGroup = document.createElement("div");
    buttonGroup.classList.add("project-button-group");

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Edit";
    editButton.addEventListener("click", () => {
      fillProjectForm(project);
    });

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.classList.add("danger-button");
    deleteButton.addEventListener("click", async () => {
      await deleteProject(project.id);
    });

    buttonGroup.appendChild(editButton);
    buttonGroup.appendChild(deleteButton);

    projectItem.appendChild(title);
    projectItem.appendChild(description);
    projectItem.appendChild(technologies);
    projectItem.appendChild(meta);
    projectItem.appendChild(buttonGroup);

    projectsList.appendChild(projectItem);
  });
}

// ==============================
// FILL PROJECT FORM FOR EDITING
// ==============================
function fillProjectForm(project) {
  document.getElementById("project-form-title").textContent = "Edit Project";
  document.getElementById("project-id").value = project.id;
  document.getElementById("project-title").value = project.title;
  document.getElementById("project-description").value = project.description;

  document.getElementById("project-technologies").value =
    Array.isArray(project.technologies)
      ? project.technologies.join(", ")
      : "";

  const links = Array.isArray(project.links) ? project.links : [];

  const liveLink = links.find(link => link.label === "View Website");
  const sourceLink = links.find(link => link.label === "View Source Code");

  document.getElementById("project-live-url").value = liveLink ? liveLink.url : "";
  document.getElementById("project-source-url").value = sourceLink ? sourceLink.url : "";

  document.getElementById("project-display-order").value =
    project.display_order || 0;

  document.getElementById("project-featured").checked = project.is_featured;
  document.getElementById("project-published").checked = project.is_published;

  document.getElementById("cancel-edit-button").style.display = "block";

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// ==============================
// RESET PROJECT FORM
// ==============================
async function resetProjectForm() {
  const projectForm = document.getElementById("project-form");

  document.getElementById("project-form-title").textContent = "Add New Project";
  document.getElementById("project-id").value = "";
  document.getElementById("cancel-edit-button").style.display = "none";

  if (projectForm) {
    projectForm.reset();
  }

  document.getElementById("project-published").checked = true;

  await setNextDisplayOrder();
}

// ==============================
// DELETE PROJECT
// ==============================
async function deleteProject(projectId) {
  const adminStatus = document.getElementById("admin-status");

  const confirmed = confirm("Are you sure you want to delete this project?");

  if (!confirmed) return;

  adminStatus.textContent = "Deleting project...";

  const { error } = await supabaseClient
    .from("projects")
    .delete()
    .eq("id", projectId);

  if (error) {
    console.error("Delete project error:", error);
    adminStatus.textContent = "Failed to delete project.";
    return;
  }

  adminStatus.textContent = "Project deleted successfully.";
  await loadProjects();
}