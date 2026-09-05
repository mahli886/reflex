const API_URL = "http://127.0.0.1:5000";


// =====================================================
// CHANGE ROLE
// =====================================================

function changeRole() {

    const role = document.getElementById("role").value;

    document.getElementById("retailer-view")
        .classList.add("hidden");

    document.getElementById("dispatcher-view")
        .classList.add("hidden");

    document.getElementById("rider-view")
        .classList.add("hidden");


    if (role === "retailer") {

        document.getElementById("retailer-view")
            .classList.remove("hidden");

        loadDeliveries();

    }


    if (role === "dispatcher") {

        document.getElementById("dispatcher-view")
            .classList.remove("hidden");

        loadDispatcher();

    }


    if (role === "rider") {

        document.getElementById("rider-view")
            .classList.remove("hidden");

        loadRider();

    }

}


// =====================================================
// CREATE DELIVERY
// =====================================================

document
    .getElementById("delivery-form")
    .addEventListener("submit", async function(event) {

        event.preventDefault();


        const customer_name =
            document.getElementById("customer_name").value;

        const customer_phone =
            document.getElementById("customer_phone").value;

        const address =
            document.getElementById("address").value;

        const item_description =
            document.getElementById("item_description").value;


        try {

            const response = await fetch(
                `${API_URL}/api/deliveries`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({
                        customer_name: customer_name,
                        customer_phone: customer_phone,
                        address: address,
                        item_description: item_description
                    })
                }
            );


            const data = await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error || "Could not create delivery"
                );

            }


            document.getElementById("form-message").innerHTML =
                `<p class="success">
                    Delivery created successfully.
                    Confirmation code:
                    <strong>${data.confirmation_code}</strong>
                </p>`;


            document.getElementById("delivery-form").reset();


            loadDeliveries();

        }

        catch (error) {

            document.getElementById("form-message").innerHTML =
                `<p class="error">
                    ${error.message}
                </p>`;

        }

    });


// =====================================================
// LOAD ALL DELIVERIES
// =====================================================

async function loadDeliveries() {

    try {

        const response = await fetch(
            `${API_URL}/api/deliveries`
        );


        const deliveries = await response.json();


        const container =
            document.getElementById("retailer-deliveries");


        if (deliveries.length === 0) {

            container.innerHTML =
                `<p class="empty">
                    No delivery requests yet.
                </p>`;

            return;
        }


        container.innerHTML =
            deliveries.map(delivery => `

                <div class="delivery">

                    <div class="delivery-top">

                        <span class="delivery-id">
                            Delivery #${delivery.id}
                        </span>

                        <span class="status status-${delivery.status}">
                            ${delivery.status}
                        </span>

                    </div>

                    <p>
                        <strong>Customer:</strong>
                        ${delivery.customer_name}
                    </p>

                    <p>
                        <strong>Phone:</strong>
                        ${delivery.customer_phone}
                    </p>

                    <p>
                        <strong>Address:</strong>
                        ${delivery.address}
                    </p>

                    <p>
                        <strong>Item:</strong>
                        ${delivery.item_description}
                    </p>

                    <p>
                        <strong>Rider:</strong>
                        ${delivery.rider_name || "Not assigned"}
                    </p>

                    ${
                        delivery.status === "DELIVERED"
                        || delivery.status === "CONFIRMED"
                        ?
                        `
                        <p>
                            <strong>Confirmation Code:</strong>
                            ${delivery.confirmation_code}
                        </p>
                        `
                        :
                        ""
                    }

                </div>

            `).join("");

    }

    catch (error) {

        console.error(
            "Error loading deliveries:",
            error
        );

    }

}


// =====================================================
// LOAD DISPATCHER DASHBOARD
// =====================================================

async function loadDispatcher() {

    try {

        const response = await fetch(
            `${API_URL}/api/deliveries`
        );


        const deliveries = await response.json();


        const openCount =
            deliveries.filter(
                delivery => delivery.status === "OPEN"
            ).length;


        const assignedCount =
            deliveries.filter(
                delivery =>
                    delivery.status === "ASSIGNED" ||
                    delivery.status === "PICKED_UP"
            ).length;


        const deliveredCount =
            deliveries.filter(
                delivery =>
                    delivery.status === "DELIVERED" ||
                    delivery.status === "CONFIRMED"
            ).length;


        document.getElementById("open-count")
            .textContent = openCount;


        document.getElementById("assigned-count")
            .textContent = assignedCount;


        document.getElementById("delivered-count")
            .textContent = deliveredCount;


        const container =
            document.getElementById(
                "dispatcher-deliveries"
            );


        if (deliveries.length === 0) {

            container.innerHTML =
                `<p class="empty">
                    No deliveries found.
                </p>`;

            return;
        }


        const ridersResponse =
            await fetch(`${API_URL}/api/riders`);


        const riders =
            await ridersResponse.json();


        container.innerHTML =
            deliveries.map(delivery => `

                <div class="delivery">

                    <div class="delivery-top">

                        <span class="delivery-id">
                            Delivery #${delivery.id}
                        </span>

                        <span class="status status-${delivery.status}">
                            ${delivery.status}
                        </span>

                    </div>


                    <p>
                        <strong>Customer:</strong>
                        ${delivery.customer_name}
                    </p>


                    <p>
                        <strong>Phone:</strong>
                        ${delivery.customer_phone}
                    </p>


                    <p>
                        <strong>Address:</strong>
                        ${delivery.address}
                    </p>


                    <p>
                        <strong>Item:</strong>
                        ${delivery.item_description}
                    </p>


                    <p>
                        <strong>Rider:</strong>
                        ${delivery.rider_name || "Not assigned"}
                    </p>


                    ${
                        delivery.status === "OPEN"
                        ?
                        `

                        <div class="action-row">

                            <select id="rider-${delivery.id}">

                                <option value="">
                                    Select Rider
                                </option>

                                ${
                                    riders.map(rider => `
                                        <option value="${rider.id}">
                                            ${rider.name}
                                        </option>
                                    `).join("")
                                }

                            </select>


                            <button
                                onclick="assignDelivery(${delivery.id})"
                            >
                                Assign Rider
                            </button>

                        </div>

                        `
                        :
                        ""
                    }

                </div>

            `).join("");

    }

    catch (error) {

        console.error(
            "Error loading dispatcher:",
            error
        );

    }

}


// =====================================================
// ASSIGN DELIVERY
// =====================================================

async function assignDelivery(deliveryId) {

    const select =
        document.getElementById(
            `rider-${deliveryId}`
        );


    const riderId =
        Number(select.value);


    if (!riderId) {

        alert("Please select a rider.");

        return;
    }


    try {

        const response = await fetch(
            `${API_URL}/api/deliveries/${deliveryId}/assign`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    rider_id: riderId
                })
            }
        );


        const data = await response.json();


        if (!response.ok) {

            throw new Error(
                data.error || "Could not assign delivery"
            );

        }


        alert(
            "Delivery assigned successfully."
        );


        loadDispatcher();

    }

    catch (error) {

        alert(error.message);

    }

}


// =====================================================
// LOAD RIDER DELIVERIES
// =====================================================

async function loadRider() {

    try {

        const riderSelect =
            document.getElementById(
                "rider-select"
            );


        const riderId =
            Number(riderSelect.value);
           


        const response = await fetch(
            `${API_URL}/api/deliveries`
        );


        const deliveries =
            await response.json();


        const riderDeliveries =
            deliveries.filter(
                delivery =>
                    Number(delivery.rider_id) === riderId
            );


        const container =
            document.getElementById(
                "rider-deliveries"
            );


        if (riderDeliveries.length === 0) {

            container.innerHTML =
                `<p class="empty">
                    No deliveries assigned to this rider.
                </p>`;

            return;
        }


        container.innerHTML =
            riderDeliveries.map(delivery => `

                <div class="delivery">

                    <div class="delivery-top">

                        <span class="delivery-id">
                            Delivery #${delivery.id}
                        </span>

                        <span class="status status-${delivery.status}">
                            ${delivery.status}
                        </span>

                    </div>


                    <p>
                        <strong>Customer:</strong>
                        ${delivery.customer_name}
                    </p>


                    <p>
                        <strong>Phone:</strong>
                        ${delivery.customer_phone}
                    </p>


                    <p>
                        <strong>Address:</strong>
                        ${delivery.address}
                    </p>


                    <p>
                        <strong>Item:</strong>
                        ${delivery.item_description}
                    </p>


                    ${
                        delivery.status === "ASSIGNED"
                        ?
                        `
                        <div class="action-row">

                            <button
                                onclick="updateDeliveryStatus(
                                    ${delivery.id},
                                    'PICKED_UP'
                                )"
                            >
                                Mark Picked Up
                            </button>

                        </div>
                        `
                        :
                        ""
                    }


                    ${
                        delivery.status === "PICKED_UP"
                        ?
                        `
                        <div class="action-row">

                            <button
                                onclick="updateDeliveryStatus(
                                    ${delivery.id},
                                    'DELIVERED'
                                )"
                            >
                                Mark Delivered
                            </button>

                        </div>
                        `
                        :
                        ""
                    }


                    ${
                        delivery.status === "DELIVERED"
                        ?
                        `

                        <div class="action-row">

                            <input
                                type="text"
                                id="code-${delivery.id}"
                                placeholder="Enter confirmation code"
                            >


                            <button
                                onclick="confirmDelivery(
                                    ${delivery.id}
                                )"
                            >
                                Confirm Delivery
                            </button>

                        </div>

                        `
                        :
                        ""
                    }


                    ${
                        delivery.status === "CONFIRMED"
                        ?
                        `
                        <p class="success">
                            Delivery confirmed successfully.
                        </p>
                        `
                        :
                        ""
                    }

                </div>

            `).join("");

    }

    catch (error) {

        console.error(
            "Error loading rider deliveries:",
            error
        );

    }

}


// =====================================================
// UPDATE DELIVERY STATUS
// =====================================================

async function updateDeliveryStatus(
    deliveryId,
    newStatus
) {

    const riderSelect =
        document.getElementById(
            "rider-select"
        );


    const riderId =
        Number(riderSelect.value);


    try {

        const response = await fetch(
            `${API_URL}/api/deliveries/${deliveryId}/status`,
            {
                method: "PUT",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    status: newStatus,

                    rider_id: riderId

                })
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not update status"
            );

        }


        loadRider();

    }

    catch (error) {

        alert(error.message);

    }

}


// =====================================================
// CONFIRM DELIVERY
// =====================================================

async function confirmDelivery(
    deliveryId
) {

    const input =
        document.getElementById(
            `code-${deliveryId}`
        );


    const confirmationCode =
        input.value.trim();


    if (!confirmationCode) {

        alert(
            "Please enter the confirmation code."
        );

        return;
    }


    try {

        const response = await fetch(
            `${API_URL}/api/deliveries/${deliveryId}/confirm`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({

                    confirmation_code:
                        confirmationCode

                })
            }
        );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "Could not confirm delivery"
            );

        }


        alert(
            "Delivery confirmed successfully."
        );


        loadRider();

    }

    catch (error) {

        alert(error.message);

    }

}


// =====================================================
// AUTO REFRESH
// =====================================================

setInterval(function() {

    const role =
        document.getElementById(
            "role"
        ).value;


    if (role === "retailer") {

        loadDeliveries();

    }


    if (role === "dispatcher") {

        loadDispatcher();

    }


    if (role === "rider") {

        loadRider();

    }

}, 10000);


// =====================================================
// INITIAL LOAD
// =====================================================

loadDeliveries();