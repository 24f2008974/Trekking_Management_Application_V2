const { createApp } = Vue;


/* =========================================================
   Vue Application
   ========================================================= */

const app = createApp({

    data() {
        return {

            // Current page
            currentPage: "home",

            // API status
            apiStatus: "Checking API...",

            // Temporary UI state
            loading: false,

            errorMessage: "",
            successMessage: ""
        };
    },


    mounted() {
        this.checkApi();
    },


    methods: {

        /* -------------------------------------------------
           Check Flask API
           ------------------------------------------------- */

        async checkApi() {

            this.loading = true;
            this.errorMessage = "";

            try {

                const response = await fetch("/api/health");

                if (!response.ok) {
                    throw new Error(
                        `API returned status ${response.status}`
                    );
                }

                const data = await response.json();

                if (data.success) {
                    this.apiStatus = data.message;
                } else {
                    this.apiStatus = "API is not healthy";
                }

            } catch (error) {

                console.error(error);

                this.apiStatus = "Unable to connect to Flask API";

                this.errorMessage =
                    "Backend server se connection nahi ho raha.";

            } finally {

                this.loading = false;
            }
        },


        /* -------------------------------------------------
           Change current page
           ------------------------------------------------- */

        navigate(page) {
            this.currentPage = page;
            this.errorMessage = "";
            this.successMessage = "";
        },


        /* -------------------------------------------------
           Refresh API status
           ------------------------------------------------- */

        refreshApi() {
            this.checkApi();
        }
    },


    template: `

        <div class="app-container">

            <!-- =========================================
                 Navbar
                 ========================================= -->

            <nav class="navbar navbar-dark bg-dark app-navbar">
                <div class="container-fluid">

                    <span class="navbar-brand fw-bold">
                        Trekking Management Application
                    </span>

                    <span class="text-light small">
                        V2
                    </span>

                </div>
            </nav>


            <!-- =========================================
                 Main Area
                 ========================================= -->

            <main class="main-content">

                <div class="container-fluid">

                    <!-- Header -->

                    <div class="mb-4">

                        <h1 class="fw-bold">
                            Project Setup
                        </h1>

                        <p class="text-muted">
                            Vue frontend is connected with Flask backend.
                        </p>

                    </div>


                    <!-- Error -->

                    <div
                        v-if="errorMessage"
                        class="alert alert-danger"
                    >
                        {{ errorMessage }}
                    </div>


                    <!-- API Status -->

                    <div class="row g-4">

                        <div class="col-md-4">

                            <div class="card dashboard-card">

                                <div class="card-body">

                                    <h5 class="card-title">
                                        Backend
                                    </h5>

                                    <p class="card-text text-muted">
                                        Flask REST API
                                    </p>

                                    <span
                                        v-if="!loading"
                                        class="badge bg-success"
                                    >
                                        Connected
                                    </span>

                                    <span
                                        v-else
                                        class="badge bg-warning text-dark"
                                    >
                                        Checking...
                                    </span>

                                </div>

                            </div>

                        </div>


                        <div class="col-md-4">

                            <div class="card dashboard-card">

                                <div class="card-body">

                                    <h5 class="card-title">
                                        Frontend
                                    </h5>

                                    <p class="card-text text-muted">
                                        Vue.js 3
                                    </p>

                                    <span class="badge bg-success">
                                        Loaded
                                    </span>

                                </div>

                            </div>

                        </div>


                        <div class="col-md-4">

                            <div class="card dashboard-card">

                                <div class="card-body">

                                    <h5 class="card-title">
                                        API Status
                                    </h5>

                                    <p class="card-text">
                                        {{ apiStatus }}
                                    </p>

                                    <button
                                        class="btn btn-outline-primary btn-sm"
                                        @click="refreshApi"
                                    >
                                        Refresh
                                    </button>

                                </div>

                            </div>

                        </div>

                    </div>


                    <!-- =================================
                         Architecture
                         ================================= -->

                    <div class="card dashboard-card mt-4">

                        <div class="card-body">

                            <h4 class="mb-3">
                                TMA V2 Architecture
                            </h4>

                            <div class="row text-center g-3">

                                <div class="col-md-3">

                                    <div class="border rounded p-3">
                                        <strong>Vue.js</strong>
                                        <br>
                                        <small class="text-muted">
                                            Frontend
                                        </small>
                                    </div>

                                </div>

                                <div class="col-md-3">

                                    <div class="border rounded p-3">
                                        <strong>Flask</strong>
                                        <br>
                                        <small class="text-muted">
                                            REST API
                                        </small>
                                    </div>

                                </div>

                                <div class="col-md-3">

                                    <div class="border rounded p-3">
                                        <strong>SQLite</strong>
                                        <br>
                                        <small class="text-muted">
                                            Database
                                        </small>
                                    </div>

                                </div>

                                <div class="col-md-3">

                                    <div class="border rounded p-3">
                                        <strong>Redis</strong>
                                        <br>
                                        <small class="text-muted">
                                            Cache
                                        </small>
                                    </div>

                                </div>

                            </div>

                        </div>

                    </div>

                </div>

            </main>

        </div>
    `
});


/* =========================================================
   Mount Vue
   ========================================================= */

app.mount("#app");