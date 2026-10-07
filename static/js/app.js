const { createApp } = Vue;

createApp({

    data() {
        return {
            currentPage: "login",

            loading: false,
            errorMessage: "",
            successMessage: "",

            token: localStorage.getItem("access_token"),
            currentUser: null,

            loginForm: {
                email: "",
                password: ""
            },

            registerForm: {
                name: "",
                email: "",
                phone: "",
                password: "",
                confirmPassword: ""
            },

            // =================================================
            // ADMIN DASHBOARD
            // =================================================

            adminStats: {
                total_treks: 0,
                total_staff: 0,
                total_trekkers: 0,
                total_bookings: 0,
                open_treks: 0,
                completed_treks: 0
            },

            // =================================================
            // TREKS
            // =================================================

            treks: [],

            trekForm: {
                id: null,
                name: "",
                location: "",
                difficulty: "Easy",
                duration: 1,
                total_slots: 1,
                description: "",
                start_date: "",
                end_date: "",
                status: "Pending"
            },

            trekFormMode: "create",

            // =================================================
            // STAFF
            // =================================================

            staff: [],

            staffForm: {
                name: "",
                email: "",
                password: "",
                phone: "",
                experience: "",
                specialization: "",
                emergency_contact: "",
                address: ""
            },

            assignForm: {
                trek_id: "",
                staff_id: ""
            },

            // =================================================
            // USERS
            // =================================================

            users: [],

            // =================================================
            // BOOKINGS
            // =================================================

            bookings: [],

            // =================================================
            // SEARCH
            // =================================================

            searchQuery: "",

            searchResults: {
                treks: [],
                users: [],
                staff: []
            }
        };
    },


    async mounted() {

        if (this.token) {
            await this.loadCurrentUser();
        }
        else {
            this.currentPage = "login";
        }
    },


    methods: {

        // =====================================================
        // COMMON HELPERS
        // =====================================================

        clearMessages() {
            this.errorMessage = "";
            this.successMessage = "";
        },


        async apiRequest(
            url,
            options = {}
        ) {

            const headers = {
                ...(options.headers || {})
            };

            if (this.token) {
                headers["Authorization"] =
                    `Bearer ${this.token}`;
            }

            if (
                options.body &&
                !headers["Content-Type"]
            ) {
                headers["Content-Type"] =
                    "application/json";
            }

            const response = await fetch(
                url,
                {
                    ...options,
                    headers
                }
            );

            let data = {};

            try {
                data = await response.json();
            }
            catch (error) {
                data = {};
            }

            if (response.status === 401) {

                localStorage.removeItem(
                    "access_token"
                );

                this.token = null;
                this.currentUser = null;
                this.currentPage = "login";

                throw new Error(
                    "Session expired. Please login again."
                );
            }

            if (!response.ok) {

                throw new Error(
                    data.message ||
                    `Request failed (${response.status})`
                );
            }

            return data;
        },


        // =====================================================
        // AUTHENTICATION
        // =====================================================

        async login() {

            this.clearMessages();

            if (
                !this.loginForm.email ||
                !this.loginForm.password
            ) {
                this.errorMessage =
                    "Email and password are required.";

                return;
            }

            this.loading = true;

            try {

                const response = await fetch(
                    "/api/auth/login",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            email:
                                this.loginForm.email,

                            password:
                                this.loginForm.password
                        })
                    }
                );

                const data =
                    await response.json();

                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Login failed"
                    );
                }

                this.token =
                    data.access_token;

                localStorage.setItem(
                    "access_token",
                    this.token
                );

                this.currentUser =
                    data.user;

                await this.redirectByRole();

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
            finally {

                this.loading = false;
            }
        },


        async register() {

            this.clearMessages();

            if (
                !this.registerForm.name ||
                !this.registerForm.email ||
                !this.registerForm.password
            ) {

                this.errorMessage =
                    "Name, email and password are required.";

                return;
            }

            if (
                this.registerForm.password !==
                this.registerForm.confirmPassword
            ) {

                this.errorMessage =
                    "Passwords do not match.";

                return;
            }

            if (
                this.registerForm.password.length < 6
            ) {

                this.errorMessage =
                    "Password must contain at least 6 characters.";

                return;
            }

            this.loading = true;

            try {

                const response = await fetch(
                    "/api/auth/register",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({
                            name:
                                this.registerForm.name,

                            email:
                                this.registerForm.email,

                            phone:
                                this.registerForm.phone,

                            password:
                                this.registerForm.password
                        })
                    }
                );

                const data =
                    await response.json();

                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Registration failed"
                    );
                }

                this.registerForm = {
                    name: "",
                    email: "",
                    phone: "",
                    password: "",
                    confirmPassword: ""
                };

                this.currentPage =
                    "login";

                this.successMessage =
                    "Registration successful. Please login.";
            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
            finally {

                this.loading = false;
            }
        },


        async loadCurrentUser() {

            try {

                const data =
                    await this.apiRequest(
                        "/api/auth/me"
                    );

                this.currentUser =
                    data.user;

                await this.redirectByRole();
            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        async redirectByRole() {

            if (!this.currentUser) {
                this.currentPage = "login";
                return;
            }

            if (
                this.currentUser.role === "Admin"
            ) {

                this.currentPage =
                    "admin-dashboard";

                await this.loadAdminDashboard();
            }

            else if (
                this.currentUser.role === "Staff"
            ) {

                this.currentPage =
                    "staff-dashboard";
            }

            else if (
                this.currentUser.role === "Trekker"
            ) {

                this.currentPage =
                    "trekker-dashboard";
            }
        },


        async logout() {

            try {

                if (this.token) {

                    await this.apiRequest(
                        "/api/auth/logout",
                        {
                            method: "POST"
                        }
                    );
                }
            }
            catch (error) {
                console.log(error);
            }

            localStorage.removeItem(
                "access_token"
            );

            this.token = null;
            this.currentUser = null;
            this.currentPage = "login";

            this.loginForm = {
                email: "",
                password: ""
            };

            this.clearMessages();
        },


        // =====================================================
        // NAVIGATION
        // =====================================================

        async navigate(page) {

            this.clearMessages();

            this.currentPage = page;

            if (page === "admin-dashboard") {
                await this.loadAdminDashboard();
            }

            if (page === "admin-treks") {
                await this.loadTreks();
            }

            if (page === "admin-staff") {
                await this.loadStaff();
                await this.loadTreks();
            }

            if (page === "admin-users") {
                await this.loadUsers();
            }

            if (page === "admin-bookings") {
                await this.loadBookings();
            }
        },


        // =====================================================
        // ADMIN DASHBOARD
        // =====================================================

        async loadAdminDashboard() {

            try {

                const data =
                    await this.apiRequest(
                        "/api/admin/dashboard"
                    );

                this.adminStats =
                    data.stats;
            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // TREKS
        // =====================================================

        async loadTreks() {

            try {

                const data =
                    await this.apiRequest(
                        "/api/admin/treks"
                    );

                this.treks =
                    data.treks;
            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        resetTrekForm() {

            this.trekForm = {
                id: null,
                name: "",
                location: "",
                difficulty: "Easy",
                duration: 1,
                total_slots: 1,
                description: "",
                start_date: "",
                end_date: "",
                status: "Pending"
            };

            this.trekFormMode =
                "create";
        },


        async saveTrek() {

            this.clearMessages();

            if (
                !this.trekForm.name ||
                !this.trekForm.location
            ) {

                this.errorMessage =
                    "Trek name and location are required.";

                return;
            }

            this.loading = true;

            try {

                const payload = {
                    name:
                        this.trekForm.name,

                    location:
                        this.trekForm.location,

                    difficulty:
                        this.trekForm.difficulty,

                    duration:
                        Number(
                            this.trekForm.duration
                        ),

                    total_slots:
                        Number(
                            this.trekForm.total_slots
                        ),

                    description:
                        this.trekForm.description,

                    start_date:
                        this.trekForm.start_date,

                    end_date:
                        this.trekForm.end_date,

                    status:
                        this.trekForm.status
                };


                if (
                    this.trekFormMode ===
                    "create"
                ) {

                    await this.apiRequest(
                        "/api/admin/treks",
                        {
                            method: "POST",
                            body:
                                JSON.stringify(
                                    payload
                                )
                        }
                    );

                    this.successMessage =
                        "Trek created successfully.";
                }

                else {

                    await this.apiRequest(
                        `/api/admin/treks/${this.trekForm.id}`,
                        {
                            method: "PUT",
                            body:
                                JSON.stringify(
                                    payload
                                )
                        }
                    );

                    this.successMessage =
                        "Trek updated successfully.";
                }

                this.resetTrekForm();

                await this.loadTreks();
                await this.loadAdminDashboard();

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
            finally {

                this.loading = false;
            }
        },


        editTrek(trek) {

            this.clearMessages();

            this.trekFormMode =
                "edit";

            this.trekForm = {
                id: trek.id,

                name:
                    trek.name,

                location:
                    trek.location,

                difficulty:
                    trek.difficulty,

                duration:
                    trek.duration,

                total_slots:
                    trek.total_slots,

                description:
                    trek.description || "",

                start_date:
                    trek.start_date || "",

                end_date:
                    trek.end_date || "",

                status:
                    trek.status
            };

            window.scrollTo({
                top: 0,
                behavior: "smooth"
            });
        },


        async deleteTrek(trek) {

            const confirmed =
                confirm(
                    `Delete "${trek.name}"?`
                );

            if (!confirmed) {
                return;
            }

            this.clearMessages();

            try {

                const data =
                    await this.apiRequest(
                        `/api/admin/treks/${trek.id}`,
                        {
                            method: "DELETE"
                        }
                    );

                this.successMessage =
                    data.message;

                await this.loadTreks();
                await this.loadAdminDashboard();

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // STAFF
        // =====================================================

        async loadStaff() {

            try {

                const data =
                    await this.apiRequest(
                        "/api/admin/staff"
                    );

                this.staff =
                    data.staff;
            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        async createStaff() {

            this.clearMessages();

            if (
                !this.staffForm.name ||
                !this.staffForm.email ||
                !this.staffForm.password
            ) {

                this.errorMessage =
                    "Name, email and password are required.";

                return;
            }

            try {

                const data =
                    await this.apiRequest(
                        "/api/admin/staff",
                        {
                            method: "POST",

                            body:
                                JSON.stringify(
                                    this.staffForm
                                )
                        }
                    );

                this.successMessage =
                    data.message;

                this.staffForm = {
                    name: "",
                    email: "",
                    password: "",
                    phone: "",
                    experience: "",
                    specialization: "",
                    emergency_contact: "",
                    address: ""
                };

                await this.loadStaff();
                await this.loadAdminDashboard();

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        async assignStaff() {

            this.clearMessages();

            if (
                !this.assignForm.trek_id ||
                !this.assignForm.staff_id
            ) {

                this.errorMessage =
                    "Select both trek and staff member.";

                return;
            }

            try {

                const data =
                    await this.apiRequest(
                        `/api/admin/treks/${this.assignForm.trek_id}/assign-staff`,
                        {
                            method: "POST",

                            body:
                                JSON.stringify({
                                    staff_id:
                                        Number(
                                            this.assignForm.staff_id
                                        )
                                })
                        }
                    );

                this.successMessage =
                    data.message;

                this.assignForm = {
                    trek_id: "",
                    staff_id: ""
                };

                await this.loadTreks();
                await this.loadStaff();

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // USERS
        // =====================================================

        async loadUsers() {

            try {

                const data =
                    await this.apiRequest(
                        "/api/admin/users"
                    );

                this.users =
                    data.users;
            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        async setUserBlacklist(
            user,
            blacklisted
        ) {

            try {

                await this.apiRequest(
                    `/api/admin/users/${user.id}/status`,
                    {
                        method: "PATCH",

                        body:
                            JSON.stringify({
                                is_active:
                                    Boolean(
                                        user.is_active
                                    ),

                                is_blacklisted:
                                    blacklisted
                            })
                    }
                );

                this.successMessage =
                    blacklisted
                    ? `${user.name} blacklisted.`
                    : `${user.name} removed from blacklist.`;

                await this.loadUsers();

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        async setUserActive(
            user,
            active
        ) {

            try {

                await this.apiRequest(
                    `/api/admin/users/${user.id}/status`,
                    {
                        method: "PATCH",

                        body:
                            JSON.stringify({
                                is_active:
                                    active,

                                is_blacklisted:
                                    Boolean(
                                        user.is_blacklisted
                                    )
                            })
                    }
                );

                this.successMessage =
                    active
                    ? `${user.name} activated.`
                    : `${user.name} deactivated.`;

                await this.loadUsers();

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // BOOKINGS
        // =====================================================

        async loadBookings() {

            try {

                const data =
                    await this.apiRequest(
                        "/api/admin/bookings"
                    );

                this.bookings =
                    data.bookings;
            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        },


        // =====================================================
        // SEARCH
        // =====================================================

        async performSearch() {

            this.clearMessages();

            if (!this.searchQuery.trim()) {

                this.searchResults = {
                    treks: [],
                    users: [],
                    staff: []
                };

                return;
            }

            try {

                const data =
                    await this.apiRequest(
                        `/api/admin/search?q=${encodeURIComponent(
                            this.searchQuery
                        )}`
                    );

                this.searchResults = {
                    treks:
                        data.treks,

                    users:
                        data.users,

                    staff:
                        data.staff
                };

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        }
    },


    template: `

    <div>

        <!-- ================================================= -->
        <!-- LOGIN -->
        <!-- ================================================= -->

        <div
            v-if="currentPage === 'login'"
            class="auth-container"
        >

            <div class="card auth-card">

                <div class="card-body p-4">

                    <h2 class="fw-bold text-center">
                        Trekking Management
                    </h2>

                    <p class="text-muted text-center">
                        Login to continue
                    </p>


                    <div
                        v-if="errorMessage"
                        class="alert alert-danger"
                    >
                        {{ errorMessage }}
                    </div>


                    <div
                        v-if="successMessage"
                        class="alert alert-success"
                    >
                        {{ successMessage }}
                    </div>


                    <form @submit.prevent="login">

                        <div class="mb-3">

                            <label class="form-label">
                                Email
                            </label>

                            <input
                                v-model.trim="loginForm.email"
                                class="form-control"
                                type="email"
                            >

                        </div>


                        <div class="mb-3">

                            <label class="form-label">
                                Password
                            </label>

                            <input
                                v-model="loginForm.password"
                                class="form-control"
                                type="password"
                            >

                        </div>


                        <button
                            class="btn btn-primary w-100"
                            :disabled="loading"
                        >
                            {{ loading ? "Logging in..." : "Login" }}
                        </button>

                    </form>


                    <hr>


                    <div class="text-center">

                        New Trekker?

                        <button
                            class="btn btn-link p-0"
                            @click="currentPage='register'"
                        >
                            Create Account
                        </button>

                    </div>

                </div>

            </div>

        </div>



        <!-- ================================================= -->
        <!-- REGISTER -->
        <!-- ================================================= -->

        <div
            v-else-if="currentPage === 'register'"
            class="auth-container"
        >

            <div class="card auth-card">

                <div class="card-body p-4">

                    <h2 class="fw-bold text-center">
                        Trekker Registration
                    </h2>


                    <div
                        v-if="errorMessage"
                        class="alert alert-danger"
                    >
                        {{ errorMessage }}
                    </div>


                    <form @submit.prevent="register">

                        <input
                            v-model.trim="registerForm.name"
                            class="form-control mb-3"
                            placeholder="Full Name"
                        >

                        <input
                            v-model.trim="registerForm.email"
                            class="form-control mb-3"
                            type="email"
                            placeholder="Email"
                        >

                        <input
                            v-model.trim="registerForm.phone"
                            class="form-control mb-3"
                            placeholder="Phone"
                        >

                        <input
                            v-model="registerForm.password"
                            class="form-control mb-3"
                            type="password"
                            placeholder="Password"
                        >

                        <input
                            v-model="registerForm.confirmPassword"
                            class="form-control mb-3"
                            type="password"
                            placeholder="Confirm Password"
                        >


                        <button
                            class="btn btn-success w-100"
                        >
                            Register
                        </button>

                    </form>


                    <hr>


                    <button
                        class="btn btn-link w-100"
                        @click="currentPage='login'"
                    >
                        Back to Login
                    </button>

                </div>

            </div>

        </div>



        <!-- ================================================= -->
        <!-- LOGGED-IN APPLICATION -->
        <!-- ================================================= -->

        <div v-else>

            <nav class="navbar navbar-dark bg-dark px-3">

                <span class="navbar-brand fw-bold">
                    Trekking Management V2
                </span>


                <div class="text-light">

                    <span v-if="currentUser">
                        {{ currentUser.name }}
                        |
                        {{ currentUser.role }}
                    </span>

                    <button
                        class="btn btn-outline-light btn-sm ms-3"
                        @click="logout"
                    >
                        Logout
                    </button>

                </div>

            </nav>


            <div class="container-fluid">

                <div class="row">


                    <!-- ===================================== -->
                    <!-- ADMIN SIDEBAR -->
                    <!-- ===================================== -->

                    <aside
                        v-if="currentUser &&
                              currentUser.role === 'Admin'"
                        class="col-md-2 sidebar p-3"
                    >

                        <h6 class="text-white mb-3">
                            ADMIN PANEL
                        </h6>


                        <button
                            class="nav-link text-start"
                            :class="{active:currentPage==='admin-dashboard'}"
                            @click="navigate('admin-dashboard')"
                        >
                            Dashboard
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{active:currentPage==='admin-treks'}"
                            @click="navigate('admin-treks')"
                        >
                            Manage Treks
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{active:currentPage==='admin-staff'}"
                            @click="navigate('admin-staff')"
                        >
                            Trek Staff
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{active:currentPage==='admin-users'}"
                            @click="navigate('admin-users')"
                        >
                            Users
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{active:currentPage==='admin-bookings'}"
                            @click="navigate('admin-bookings')"
                        >
                            Bookings
                        </button>


                        <button
                            class="nav-link text-start"
                            :class="{active:currentPage==='admin-search'}"
                            @click="navigate('admin-search')"
                        >
                            Search
                        </button>

                    </aside>



                    <!-- ===================================== -->
                    <!-- STAFF SIDEBAR -->
                    <!-- ===================================== -->

                    <aside
                        v-if="currentUser &&
                              currentUser.role === 'Staff'"
                        class="col-md-2 sidebar p-3"
                    >

                        <h6 class="text-white">
                            TREK STAFF
                        </h6>

                        <button
                            class="nav-link active text-start"
                        >
                            Dashboard
                        </button>

                    </aside>



                    <!-- ===================================== -->
                    <!-- TREKKER SIDEBAR -->
                    <!-- ===================================== -->

                    <aside
                        v-if="currentUser &&
                              currentUser.role === 'Trekker'"
                        class="col-md-2 sidebar p-3"
                    >

                        <h6 class="text-white">
                            TREKKER
                        </h6>

                        <button
                            class="nav-link active text-start"
                        >
                            Dashboard
                        </button>

                    </aside>



                    <!-- ===================================== -->
                    <!-- MAIN -->
                    <!-- ===================================== -->

                    <main class="col-md-10 main-content">

                        <div
                            v-if="errorMessage"
                            class="alert alert-danger"
                        >
                            {{ errorMessage }}
                        </div>


                        <div
                            v-if="successMessage"
                            class="alert alert-success"
                        >
                            {{ successMessage }}
                        </div>



                        <!-- ================================ -->
                        <!-- ADMIN DASHBOARD -->
                        <!-- ================================ -->

                        <div
                            v-if="currentPage==='admin-dashboard'"
                        >

                            <h2 class="fw-bold mb-4">
                                Admin Dashboard
                            </h2>


                            <div class="row g-3">

                                <div class="col-md-4 col-lg-2">
                                    <div class="card dashboard-card">
                                        <div class="card-body text-center">

                                            <h3>
                                                {{ adminStats.total_treks }}
                                            </h3>

                                            <span class="text-muted">
                                                Total Treks
                                            </span>

                                        </div>
                                    </div>
                                </div>


                                <div class="col-md-4 col-lg-2">
                                    <div class="card dashboard-card">
                                        <div class="card-body text-center">

                                            <h3>
                                                {{ adminStats.total_staff }}
                                            </h3>

                                            <span class="text-muted">
                                                Staff
                                            </span>

                                        </div>
                                    </div>
                                </div>


                                <div class="col-md-4 col-lg-2">
                                    <div class="card dashboard-card">
                                        <div class="card-body text-center">

                                            <h3>
                                                {{ adminStats.total_trekkers }}
                                            </h3>

                                            <span class="text-muted">
                                                Trekkers
                                            </span>

                                        </div>
                                    </div>
                                </div>


                                <div class="col-md-4 col-lg-2">
                                    <div class="card dashboard-card">
                                        <div class="card-body text-center">

                                            <h3>
                                                {{ adminStats.total_bookings }}
                                            </h3>

                                            <span class="text-muted">
                                                Bookings
                                            </span>

                                        </div>
                                    </div>
                                </div>


                                <div class="col-md-4 col-lg-2">
                                    <div class="card dashboard-card">
                                        <div class="card-body text-center">

                                            <h3>
                                                {{ adminStats.open_treks }}
                                            </h3>

                                            <span class="text-muted">
                                                Open
                                            </span>

                                        </div>
                                    </div>
                                </div>


                                <div class="col-md-4 col-lg-2">
                                    <div class="card dashboard-card">
                                        <div class="card-body text-center">

                                            <h3>
                                                {{ adminStats.completed_treks }}
                                            </h3>

                                            <span class="text-muted">
                                                Completed
                                            </span>

                                        </div>
                                    </div>
                                </div>

                            </div>

                        </div>



                        <!-- ================================ -->
                        <!-- MANAGE TREKS -->
                        <!-- ================================ -->

                        <div
                            v-else-if="currentPage==='admin-treks'"
                        >

                            <h2 class="fw-bold">
                                Manage Treks
                            </h2>


                            <div class="card dashboard-card my-4">

                                <div class="card-body">

                                    <h5>
                                        {{ trekFormMode === 'create'
                                            ? 'Create New Trek'
                                            : 'Edit Trek' }}
                                    </h5>


                                    <form @submit.prevent="saveTrek">

                                        <div class="row g-3">

                                            <div class="col-md-6">
                                                <label class="form-label">
                                                    Trek Name
                                                </label>

                                                <input
                                                    v-model.trim="trekForm.name"
                                                    class="form-control"
                                                >
                                            </div>


                                            <div class="col-md-6">
                                                <label class="form-label">
                                                    Location
                                                </label>

                                                <input
                                                    v-model.trim="trekForm.location"
                                                    class="form-control"
                                                >
                                            </div>


                                            <div class="col-md-4">

                                                <label class="form-label">
                                                    Difficulty
                                                </label>

                                                <select
                                                    v-model="trekForm.difficulty"
                                                    class="form-select"
                                                >
                                                    <option>Easy</option>
                                                    <option>Moderate</option>
                                                    <option>Hard</option>
                                                </select>

                                            </div>


                                            <div class="col-md-4">

                                                <label class="form-label">
                                                    Duration (Days)
                                                </label>

                                                <input
                                                    v-model.number="trekForm.duration"
                                                    class="form-control"
                                                    type="number"
                                                    min="1"
                                                >

                                            </div>


                                            <div class="col-md-4">

                                                <label class="form-label">
                                                    Total Slots
                                                </label>

                                                <input
                                                    v-model.number="trekForm.total_slots"
                                                    class="form-control"
                                                    type="number"
                                                    min="1"
                                                >

                                            </div>


                                            <div class="col-md-4">

                                                <label class="form-label">
                                                    Start Date
                                                </label>

                                                <input
                                                    v-model="trekForm.start_date"
                                                    class="form-control"
                                                    type="date"
                                                >

                                            </div>


                                            <div class="col-md-4">

                                                <label class="form-label">
                                                    End Date
                                                </label>

                                                <input
                                                    v-model="trekForm.end_date"
                                                    class="form-control"
                                                    type="date"
                                                >

                                            </div>


                                            <div class="col-md-4">

                                                <label class="form-label">
                                                    Status
                                                </label>

                                                <select
                                                    v-model="trekForm.status"
                                                    class="form-select"
                                                >
                                                    <option>Pending</option>
                                                    <option>Approved</option>
                                                    <option>Open</option>
                                                    <option>Closed</option>
                                                    <option>Completed</option>
                                                </select>

                                            </div>


                                            <div class="col-12">

                                                <label class="form-label">
                                                    Description
                                                </label>

                                                <textarea
                                                    v-model.trim="trekForm.description"
                                                    class="form-control"
                                                    rows="3"
                                                ></textarea>

                                            </div>


                                            <div class="col-12">

                                                <button
                                                    class="btn btn-primary"
                                                >
                                                    {{ trekFormMode === 'create'
                                                        ? 'Create Trek'
                                                        : 'Save Changes' }}
                                                </button>


                                                <button
                                                    v-if="trekFormMode==='edit'"
                                                    type="button"
                                                    class="btn btn-secondary ms-2"
                                                    @click="resetTrekForm"
                                                >
                                                    Cancel Edit
                                                </button>

                                            </div>

                                        </div>

                                    </form>

                                </div>

                            </div>


                            <div class="table-responsive table-container">

                                <table class="table table-hover align-middle">

                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Trek</th>
                                            <th>Location</th>
                                            <th>Difficulty</th>
                                            <th>Slots</th>
                                            <th>Staff</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>


                                    <tbody>

                                        <tr
                                            v-for="trek in treks"
                                            :key="trek.id"
                                        >

                                            <td>
                                                {{ trek.id }}
                                            </td>

                                            <td>
                                                {{ trek.name }}
                                            </td>

                                            <td>
                                                {{ trek.location }}
                                            </td>

                                            <td>
                                                {{ trek.difficulty }}
                                            </td>

                                            <td>
                                                {{ trek.available_slots }}
                                                /
                                                {{ trek.total_slots }}
                                            </td>

                                            <td>
                                                {{ trek.assigned_staff || 'Not Assigned' }}
                                            </td>

                                            <td>
                                                <span
                                                    class="badge bg-secondary"
                                                >
                                                    {{ trek.status }}
                                                </span>
                                            </td>

                                            <td>

                                                <button
                                                    class="btn btn-warning btn-sm me-2"
                                                    @click="editTrek(trek)"
                                                >
                                                    Edit
                                                </button>

                                                <button
                                                    class="btn btn-danger btn-sm"
                                                    @click="deleteTrek(trek)"
                                                >
                                                    Delete
                                                </button>

                                            </td>

                                        </tr>


                                        <tr v-if="treks.length===0">

                                            <td
                                                colspan="8"
                                                class="text-center text-muted"
                                            >
                                                No treks found.
                                            </td>

                                        </tr>

                                    </tbody>

                                </table>

                            </div>

                        </div>



                        <!-- ================================ -->
                        <!-- STAFF -->
                        <!-- ================================ -->

                        <div
                            v-else-if="currentPage==='admin-staff'"
                        >

                            <h2 class="fw-bold">
                                Trek Staff
                            </h2>


                            <div class="row g-4 my-3">

                                <div class="col-lg-7">

                                    <div class="card dashboard-card">

                                        <div class="card-body">

                                            <h5>
                                                Create Staff
                                            </h5>


                                            <form
                                                @submit.prevent="createStaff"
                                            >

                                                <div class="row g-3">

                                                    <div class="col-md-6">
                                                        <input
                                                            v-model.trim="staffForm.name"
                                                            class="form-control"
                                                            placeholder="Name"
                                                        >
                                                    </div>


                                                    <div class="col-md-6">
                                                        <input
                                                            v-model.trim="staffForm.email"
                                                            class="form-control"
                                                            type="email"
                                                            placeholder="Email"
                                                        >
                                                    </div>


                                                    <div class="col-md-6">
                                                        <input
                                                            v-model="staffForm.password"
                                                            class="form-control"
                                                            type="password"
                                                            placeholder="Password"
                                                        >
                                                    </div>


                                                    <div class="col-md-6">
                                                        <input
                                                            v-model.trim="staffForm.phone"
                                                            class="form-control"
                                                            placeholder="Phone"
                                                        >
                                                    </div>


                                                    <div class="col-md-6">
                                                        <input
                                                            v-model.trim="staffForm.experience"
                                                            class="form-control"
                                                            placeholder="Experience"
                                                        >
                                                    </div>


                                                    <div class="col-md-6">
                                                        <input
                                                            v-model.trim="staffForm.specialization"
                                                            class="form-control"
                                                            placeholder="Specialization"
                                                        >
                                                    </div>


                                                    <div class="col-md-6">
                                                        <input
                                                            v-model.trim="staffForm.emergency_contact"
                                                            class="form-control"
                                                            placeholder="Emergency Contact"
                                                        >
                                                    </div>


                                                    <div class="col-md-6">
                                                        <input
                                                            v-model.trim="staffForm.address"
                                                            class="form-control"
                                                            placeholder="Address"
                                                        >
                                                    </div>


                                                    <div class="col-12">

                                                        <button
                                                            class="btn btn-success"
                                                        >
                                                            Create Staff
                                                        </button>

                                                    </div>

                                                </div>

                                            </form>

                                        </div>

                                    </div>

                                </div>


                                <div class="col-lg-5">

                                    <div class="card dashboard-card">

                                        <div class="card-body">

                                            <h5>
                                                Assign Staff
                                            </h5>


                                            <select
                                                v-model="assignForm.trek_id"
                                                class="form-select mb-3"
                                            >

                                                <option value="">
                                                    Select Trek
                                                </option>

                                                <option
                                                    v-for="trek in treks"
                                                    :key="trek.id"
                                                    :value="trek.id"
                                                >
                                                    {{ trek.name }}
                                                </option>

                                            </select>


                                            <select
                                                v-model="assignForm.staff_id"
                                                class="form-select mb-3"
                                            >

                                                <option value="">
                                                    Select Staff
                                                </option>

                                                <option
                                                    v-for="person in staff"
                                                    :key="person.id"
                                                    :value="person.id"
                                                >
                                                    {{ person.name }}
                                                </option>

                                            </select>


                                            <button
                                                class="btn btn-primary"
                                                @click="assignStaff"
                                            >
                                                Assign Staff
                                            </button>

                                        </div>

                                    </div>

                                </div>

                            </div>


                            <div class="table-responsive table-container">

                                <table class="table">

                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Phone</th>
                                            <th>Specialization</th>
                                            <th>Assigned Treks</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>


                                    <tbody>

                                        <tr
                                            v-for="person in staff"
                                            :key="person.id"
                                        >

                                            <td>
                                                {{ person.id }}
                                            </td>

                                            <td>
                                                {{ person.name }}
                                            </td>

                                            <td>
                                                {{ person.email }}
                                            </td>

                                            <td>
                                                {{ person.phone || '-' }}
                                            </td>

                                            <td>
                                                {{ person.specialization || '-' }}
                                            </td>

                                            <td>
                                                {{ person.assigned_treks }}
                                            </td>

                                            <td>

                                                <span
                                                    v-if="person.is_blacklisted"
                                                    class="badge bg-danger"
                                                >
                                                    Blacklisted
                                                </span>

                                                <span
                                                    v-else-if="person.is_active"
                                                    class="badge bg-success"
                                                >
                                                    Active
                                                </span>

                                                <span
                                                    v-else
                                                    class="badge bg-secondary"
                                                >
                                                    Inactive
                                                </span>

                                            </td>

                                        </tr>

                                    </tbody>

                                </table>

                            </div>

                        </div>



                        <!-- ================================ -->
                        <!-- USERS -->
                        <!-- ================================ -->

                        <div
                            v-else-if="currentPage==='admin-users'"
                        >

                            <h2 class="fw-bold mb-4">
                                Manage Users
                            </h2>


                            <div class="table-responsive table-container">

                                <table class="table table-hover">

                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Name</th>
                                            <th>Role</th>
                                            <th>Email</th>
                                            <th>Active</th>
                                            <th>Blacklist</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>


                                    <tbody>

                                        <tr
                                            v-for="user in users"
                                            :key="user.id"
                                        >

                                            <td>
                                                {{ user.id }}
                                            </td>

                                            <td>
                                                {{ user.name }}
                                            </td>

                                            <td>
                                                {{ user.role }}
                                            </td>

                                            <td>
                                                {{ user.email }}
                                            </td>

                                            <td>
                                                {{ user.is_active ? 'Yes' : 'No' }}
                                            </td>

                                            <td>
                                                {{ user.is_blacklisted ? 'Yes' : 'No' }}
                                            </td>

                                            <td>

                                                <button
                                                    v-if="user.is_active"
                                                    class="btn btn-secondary btn-sm me-1"
                                                    @click="setUserActive(user,false)"
                                                >
                                                    Deactivate
                                                </button>

                                                <button
                                                    v-else
                                                    class="btn btn-success btn-sm me-1"
                                                    @click="setUserActive(user,true)"
                                                >
                                                    Activate
                                                </button>


                                                <button
                                                    v-if="!user.is_blacklisted"
                                                    class="btn btn-danger btn-sm"
                                                    @click="setUserBlacklist(user,true)"
                                                >
                                                    Blacklist
                                                </button>

                                                <button
                                                    v-else
                                                    class="btn btn-warning btn-sm"
                                                    @click="setUserBlacklist(user,false)"
                                                >
                                                    Remove Blacklist
                                                </button>

                                            </td>

                                        </tr>

                                    </tbody>

                                </table>

                            </div>

                        </div>



                        <!-- ================================ -->
                        <!-- BOOKINGS -->
                        <!-- ================================ -->

                        <div
                            v-else-if="currentPage==='admin-bookings'"
                        >

                            <h2 class="fw-bold mb-4">
                                All Bookings
                            </h2>


                            <div class="table-responsive table-container">

                                <table class="table">

                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>User</th>
                                            <th>Trek</th>
                                            <th>Date</th>
                                            <th>Booking Status</th>
                                            <th>Payment</th>
                                        </tr>
                                    </thead>


                                    <tbody>

                                        <tr
                                            v-for="booking in bookings"
                                            :key="booking.id"
                                        >

                                            <td>
                                                {{ booking.id }}
                                            </td>

                                            <td>
                                                {{ booking.user_name }}
                                            </td>

                                            <td>
                                                {{ booking.trek_name }}
                                            </td>

                                            <td>
                                                {{ booking.booking_date }}
                                            </td>

                                            <td>
                                                {{ booking.status }}
                                            </td>

                                            <td>
                                                {{ booking.payment_status }}
                                            </td>

                                        </tr>


                                        <tr v-if="bookings.length===0">

                                            <td
                                                colspan="6"
                                                class="text-center text-muted"
                                            >
                                                No bookings yet.
                                            </td>

                                        </tr>

                                    </tbody>

                                </table>

                            </div>

                        </div>



                        <!-- ================================ -->
                        <!-- SEARCH -->
                        <!-- ================================ -->

                        <div
                            v-else-if="currentPage==='admin-search'"
                        >

                            <h2 class="fw-bold">
                                Search
                            </h2>


                            <div class="input-group my-4">

                                <input
                                    v-model.trim="searchQuery"
                                    @keyup.enter="performSearch"
                                    class="form-control"
                                    placeholder="Search trek, user or staff..."
                                >

                                <button
                                    class="btn btn-primary"
                                    @click="performSearch"
                                >
                                    Search
                                </button>

                            </div>


                            <h5>
                                Treks
                            </h5>

                            <div
                                v-for="trek in searchResults.treks"
                                :key="'t'+trek.id"
                                class="card mb-2"
                            >
                                <div class="card-body">

                                    <strong>
                                        {{ trek.name }}
                                    </strong>

                                    -
                                    {{ trek.location }}

                                </div>
                            </div>


                            <h5 class="mt-4">
                                Trekkers
                            </h5>

                            <div
                                v-for="user in searchResults.users"
                                :key="'u'+user.id"
                                class="card mb-2"
                            >
                                <div class="card-body">

                                    <strong>
                                        {{ user.name }}
                                    </strong>

                                    -
                                    {{ user.email }}

                                </div>
                            </div>


                            <h5 class="mt-4">
                                Staff
                            </h5>

                            <div
                                v-for="person in searchResults.staff"
                                :key="'s'+person.id"
                                class="card mb-2"
                            >
                                <div class="card-body">

                                    <strong>
                                        {{ person.name }}
                                    </strong>

                                    -
                                    {{ person.email }}

                                </div>
                            </div>

                        </div>



                        <!-- ================================ -->
                        <!-- STAFF PLACEHOLDER -->
                        <!-- ================================ -->

                        <div
                            v-else-if="currentPage==='staff-dashboard'"
                        >

                            <h2>
                                Trek Staff Dashboard
                            </h2>

                            <p>
                                Staff operations will be added in the next milestone.
                            </p>

                        </div>



                        <!-- ================================ -->
                        <!-- TREKKER PLACEHOLDER -->
                        <!-- ================================ -->

                        <div
                            v-else-if="currentPage==='trekker-dashboard'"
                        >

                            <h2>
                                Trekker Dashboard
                            </h2>

                            <p>
                                Trek booking features will be added in the upcoming milestone.
                            </p>

                        </div>

                    </main>

                </div>

            </div>

        </div>

    </div>
    `

}).mount("#app");