const { createApp } = Vue;


createApp({

    data() {
        return {

            // -------------------------------------------------
            // APPLICATION STATE
            // -------------------------------------------------

            currentPage: "login",

            loading: false,

            errorMessage: "",

            successMessage: "",


            // -------------------------------------------------
            // AUTHENTICATION
            // -------------------------------------------------

            token: localStorage.getItem("access_token"),

            currentUser: null,


            // -------------------------------------------------
            // LOGIN FORM
            // -------------------------------------------------

            loginForm: {
                email: "",
                password: ""
            },


            // -------------------------------------------------
            // REGISTER FORM
            // -------------------------------------------------

            registerForm: {
                name: "",
                email: "",
                phone: "",
                password: "",
                confirmPassword: ""
            }
        };
    },


    // =========================================================
    // APP START
    // =========================================================

    async mounted() {

        if (this.token) {
            await this.loadCurrentUser();
        } else {
            this.currentPage = "login";
        }
    },


    methods: {

        // =====================================================
        // COMMON MESSAGE RESET
        // =====================================================

        clearMessages() {

            this.errorMessage = "";
            this.successMessage = "";
        },


        // =====================================================
        // LOGIN
        // =====================================================

        async login() {

            this.clearMessages();

            if (!this.loginForm.email) {
                this.errorMessage = "Email is required.";
                return;
            }

            if (!this.loginForm.password) {
                this.errorMessage = "Password is required.";
                return;
            }

            this.loading = true;

            try {

                const response = await fetch(
                    "/api/auth/login",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type": "application/json"
                        },

                        body: JSON.stringify({
                            email: this.loginForm.email,
                            password: this.loginForm.password
                        })
                    }
                );


                const data = await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message || "Login failed"
                    );
                }


                // ---------------------------------------------
                // SAVE JWT
                // ---------------------------------------------

                this.token = data.access_token;

                localStorage.setItem(
                    "access_token",
                    this.token
                );


                // ---------------------------------------------
                // SAVE USER
                // ---------------------------------------------

                this.currentUser = data.user;


                // ---------------------------------------------
                // REDIRECT ACCORDING TO ROLE
                // ---------------------------------------------

                this.redirectByRole();


                this.successMessage =
                    `Welcome ${data.user.name}`;

            }
            catch (error) {

                this.errorMessage = error.message;
            }
            finally {

                this.loading = false;
            }
        },


        // =====================================================
        // REGISTER TREKKER
        // =====================================================

        async register() {

            this.clearMessages();


            if (!this.registerForm.name) {

                this.errorMessage =
                    "Name is required.";

                return;
            }


            if (!this.registerForm.email) {

                this.errorMessage =
                    "Email is required.";

                return;
            }


            if (!this.registerForm.password) {

                this.errorMessage =
                    "Password is required.";

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


            if (this.registerForm.password.length < 6) {

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
                            "Content-Type": "application/json"
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


                const data = await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Registration failed"
                    );
                }


                this.successMessage =
                    "Registration successful. Please login.";


                this.registerForm = {
                    name: "",
                    email: "",
                    phone: "",
                    password: "",
                    confirmPassword: ""
                };


                this.currentPage = "login";

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
            finally {

                this.loading = false;
            }
        },


        // =====================================================
        // CURRENT USER
        // =====================================================

        async loadCurrentUser() {

            if (!this.token) {

                this.currentPage = "login";

                return;
            }


            try {

                const response = await fetch(
                    "/api/auth/me",
                    {
                        method: "GET",

                        headers: {
                            "Authorization":
                                `Bearer ${this.token}`
                        }
                    }
                );


                if (!response.ok) {

                    throw new Error(
                        "Session expired"
                    );
                }


                const data =
                    await response.json();


                this.currentUser =
                    data.user;


                this.redirectByRole();

            }
            catch (error) {

                this.logout(false);
            }
        },


        // =====================================================
        // ROLE REDIRECTION
        // =====================================================

        redirectByRole() {

            if (!this.currentUser) {

                this.currentPage = "login";

                return;
            }


            if (
                this.currentUser.role === "Admin"
            ) {

                this.currentPage =
                    "admin-dashboard";
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


            else {

                this.logout(false);
            }
        },


        // =====================================================
        // LOGOUT
        // =====================================================

        async logout(showMessage = true) {

            try {

                if (this.token) {

                    await fetch(
                        "/api/auth/logout",
                        {
                            method: "POST",

                            headers: {
                                "Authorization":
                                    `Bearer ${this.token}`
                            }
                        }
                    );
                }

            }
            catch (error) {

                console.error(
                    "Logout API error:",
                    error
                );
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


            if (showMessage) {

                this.successMessage =
                    "Logout successful.";
            }
        },


        // =====================================================
        // PAGE NAVIGATION
        // =====================================================

        navigate(page) {

            this.clearMessages();

            this.currentPage = page;
        },


        // =====================================================
        // TEST PROTECTED ENDPOINT
        // =====================================================

        async testProtectedRoute() {

            this.clearMessages();


            try {

                const response = await fetch(
                    "/api/protected",
                    {
                        headers: {
                            "Authorization":
                                `Bearer ${this.token}`
                        }
                    }
                );


                const data =
                    await response.json();


                if (!response.ok) {

                    throw new Error(
                        data.message ||
                        "Protected API failed"
                    );
                }


                this.successMessage =
                    `${data.message} | Role: ${data.role}`;

            }
            catch (error) {

                this.errorMessage =
                    error.message;
            }
        }
    },


    // =========================================================
    // TEMPLATE
    // =========================================================

    template: `

    <div>

        <!-- ================================================= -->
        <!-- LOGIN PAGE -->
        <!-- ================================================= -->

        <div
            v-if="currentPage === 'login'"
            class="auth-container"
        >

            <div class="card auth-card">

                <div class="card-body p-4">

                    <div class="text-center mb-4">

                        <h2 class="fw-bold">
                            Trekking Management
                        </h2>

                        <p class="text-muted mb-0">
                            Login to continue
                        </p>

                    </div>


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

                            <label
                                class="form-label"
                            >
                                Email
                            </label>

                            <input
                                v-model.trim="loginForm.email"
                                type="email"
                                class="form-control"
                                placeholder="Enter email"
                            >

                        </div>


                        <div class="mb-3">

                            <label
                                class="form-label"
                            >
                                Password
                            </label>

                            <input
                                v-model="loginForm.password"
                                type="password"
                                class="form-control"
                                placeholder="Enter password"
                            >

                        </div>


                        <button
                            type="submit"
                            class="btn btn-primary w-100"
                            :disabled="loading"
                        >

                            <span v-if="loading">
                                Logging in...
                            </span>

                            <span v-else>
                                Login
                            </span>

                        </button>

                    </form>


                    <hr>


                    <p class="text-center mb-0">

                        New Trekker?

                        <button
                            class="btn btn-link p-0"
                            @click="navigate('register')"
                        >
                            Create Account
                        </button>

                    </p>

                </div>

            </div>

        </div>



        <!-- ================================================= -->
        <!-- REGISTER PAGE -->
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

                    <p class="text-muted text-center">
                        Create your trekking account
                    </p>


                    <div
                        v-if="errorMessage"
                        class="alert alert-danger"
                    >
                        {{ errorMessage }}
                    </div>


                    <form @submit.prevent="register">


                        <div class="mb-3">

                            <label class="form-label">
                                Full Name
                            </label>

                            <input
                                v-model.trim="registerForm.name"
                                type="text"
                                class="form-control"
                                placeholder="Enter full name"
                            >

                        </div>


                        <div class="mb-3">

                            <label class="form-label">
                                Email
                            </label>

                            <input
                                v-model.trim="registerForm.email"
                                type="email"
                                class="form-control"
                                placeholder="Enter email"
                            >

                        </div>


                        <div class="mb-3">

                            <label class="form-label">
                                Phone
                            </label>

                            <input
                                v-model.trim="registerForm.phone"
                                type="text"
                                class="form-control"
                                placeholder="Enter phone number"
                            >

                        </div>


                        <div class="mb-3">

                            <label class="form-label">
                                Password
                            </label>

                            <input
                                v-model="registerForm.password"
                                type="password"
                                class="form-control"
                                placeholder="Minimum 6 characters"
                            >

                        </div>


                        <div class="mb-3">

                            <label class="form-label">
                                Confirm Password
                            </label>

                            <input
                                v-model="registerForm.confirmPassword"
                                type="password"
                                class="form-control"
                                placeholder="Confirm password"
                            >

                        </div>


                        <button
                            type="submit"
                            class="btn btn-success w-100"
                            :disabled="loading"
                        >

                            <span v-if="loading">
                                Creating account...
                            </span>

                            <span v-else>
                                Register
                            </span>

                        </button>

                    </form>


                    <hr>


                    <p class="text-center mb-0">

                        Already registered?

                        <button
                            class="btn btn-link p-0"
                            @click="navigate('login')"
                        >
                            Login
                        </button>

                    </p>

                </div>

            </div>

        </div>



        <!-- ================================================= -->
        <!-- AUTHENTICATED APPLICATION -->
        <!-- ================================================= -->

        <div
            v-else
            class="app-container"
        >

            <!-- NAVBAR -->

            <nav
                class="navbar navbar-dark bg-dark app-navbar"
            >

                <div class="container-fluid">

                    <span
                        class="navbar-brand fw-bold"
                    >
                        Trekking Management
                    </span>


                    <div
                        class="d-flex align-items-center gap-3"
                    >

                        <span
                            v-if="currentUser"
                            class="text-light"
                        >
                            {{ currentUser.name }}
                            |
                            {{ currentUser.role }}
                        </span>


                        <button
                            class="btn btn-outline-light btn-sm"
                            @click="logout()"
                        >
                            Logout
                        </button>

                    </div>

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

                        <h6
                            class="text-light mb-3"
                        >
                            ADMIN
                        </h6>


                        <nav class="nav flex-column">

                            <button
                                class="nav-link text-start"
                                :class="{
                                    active:
                                    currentPage ===
                                    'admin-dashboard'
                                }"
                                @click="
                                    navigate(
                                        'admin-dashboard'
                                    )
                                "
                            >
                                Dashboard
                            </button>


                            <button
                                class="nav-link text-start"
                                disabled
                            >
                                Manage Treks
                            </button>


                            <button
                                class="nav-link text-start"
                                disabled
                            >
                                Trek Staff
                            </button>


                            <button
                                class="nav-link text-start"
                                disabled
                            >
                                Users
                            </button>


                            <button
                                class="nav-link text-start"
                                disabled
                            >
                                Bookings
                            </button>


                            <button
                                class="nav-link text-start"
                                disabled
                            >
                                Reports
                            </button>

                        </nav>

                    </aside>



                    <!-- ===================================== -->
                    <!-- STAFF SIDEBAR -->
                    <!-- ===================================== -->

                    <aside
                        v-if="currentUser &&
                              currentUser.role === 'Staff'"
                        class="col-md-2 sidebar p-3"
                    >

                        <h6 class="text-light mb-3">
                            TREK STAFF
                        </h6>


                        <nav class="nav flex-column">

                            <button
                                class="nav-link active text-start"
                            >
                                Dashboard
                            </button>


                            <button
                                class="nav-link text-start"
                                disabled
                            >
                                My Treks
                            </button>


                            <button
                                class="nav-link text-start"
                                disabled
                            >
                                Participants
                            </button>


                            <button
                                class="nav-link text-start"
                                disabled
                            >
                                Profile
                            </button>

                        </nav>

                    </aside>



                    <!-- ===================================== -->
                    <!-- TREKKER SIDEBAR -->
                    <!-- ===================================== -->

                    <aside
                        v-if="currentUser &&
                              currentUser.role === 'Trekker'"
                        class="col-md-2 sidebar p-3"
                    >

                        <h6 class="text-light mb-3">
                            TREKKER
                        </h6>


                        <nav class="nav flex-column">

                            <button
                                class="nav-link active text-start"
                            >
                                Dashboard
                            </button>


                            <button
                                class="nav-link text-start"
                                disabled
                            >
                                Browse Treks
                            </button>


                            <button
                                class="nav-link text-start"
                                disabled
                            >
                                My Bookings
                            </button>


                            <button
                                class="nav-link text-start"
                                disabled
                            >
                                History
                            </button>


                            <button
                                class="nav-link text-start"
                                disabled
                            >
                                Profile
                            </button>

                        </nav>

                    </aside>



                    <!-- ===================================== -->
                    <!-- MAIN CONTENT -->
                    <!-- ===================================== -->

                    <main
                        class="col-md-10 main-content"
                    >


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
                            v-if="
                                currentPage ===
                                'admin-dashboard'
                            "
                        >

                            <h2 class="fw-bold">
                                Admin Dashboard
                            </h2>

                            <p class="text-muted">
                                Welcome to administrator dashboard.
                            </p>


                            <div class="row g-4 mt-2">


                                <div class="col-md-4">

                                    <div
                                        class="card dashboard-card"
                                    >

                                        <div class="card-body">

                                            <h5>
                                                Authentication
                                            </h5>

                                            <p class="text-muted">
                                                JWT authentication active
                                            </p>

                                            <span
                                                class="badge bg-success"
                                            >
                                                Working
                                            </span>

                                        </div>

                                    </div>

                                </div>


                                <div class="col-md-4">

                                    <div
                                        class="card dashboard-card"
                                    >

                                        <div class="card-body">

                                            <h5>
                                                Role
                                            </h5>

                                            <h3>
                                                Admin
                                            </h3>

                                        </div>

                                    </div>

                                </div>


                                <div class="col-md-4">

                                    <div
                                        class="card dashboard-card"
                                    >

                                        <div class="card-body">

                                            <h5>
                                                Account
                                            </h5>

                                            <p class="mb-0">
                                                {{ currentUser.email }}
                                            </p>

                                        </div>

                                    </div>

                                </div>

                            </div>


                            <button
                                class="btn btn-primary mt-4"
                                @click="testProtectedRoute"
                            >
                                Test Protected API
                            </button>

                        </div>



                        <!-- ================================ -->
                        <!-- STAFF DASHBOARD -->
                        <!-- ================================ -->

                        <div
                            v-else-if="
                                currentPage ===
                                'staff-dashboard'
                            "
                        >

                            <h2 class="fw-bold">
                                Trek Staff Dashboard
                            </h2>

                            <p class="text-muted">
                                Your assigned treks will appear here.
                            </p>


                            <div class="card dashboard-card">

                                <div class="card-body">

                                    <h5>
                                        Staff Account
                                    </h5>

                                    <p>
                                        {{ currentUser.email }}
                                    </p>

                                    <span
                                        class="badge bg-primary"
                                    >
                                        Staff
                                    </span>

                                </div>

                            </div>

                        </div>



                        <!-- ================================ -->
                        <!-- TREKKER DASHBOARD -->
                        <!-- ================================ -->

                        <div
                            v-else-if="
                                currentPage ===
                                'trekker-dashboard'
                            "
                        >

                            <h2 class="fw-bold">
                                Trekker Dashboard
                            </h2>

                            <p class="text-muted">
                                Browse and book trekking routes.
                            </p>


                            <div class="card dashboard-card">

                                <div class="card-body">

                                    <h5>
                                        Welcome
                                        {{ currentUser.name }}
                                    </h5>


                                    <p>
                                        Email:
                                        {{ currentUser.email }}
                                    </p>


                                    <span
                                        class="badge bg-success"
                                    >
                                        Trekker
                                    </span>

                                </div>

                            </div>

                        </div>


                    </main>

                </div>

            </div>

        </div>

    </div>

    `

}).mount("#app");