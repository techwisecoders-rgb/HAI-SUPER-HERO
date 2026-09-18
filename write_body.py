import os
path = r'C:\Users\perum\OneDrive\Desktop\HAI-SUPER-HERO\public\business-app.html'

body = '''    <!-- =========================================================
         TOP HEADER
    ========================================================= -->
    <header class="app-header">
        <button class="btn-profile-icon" onclick="openProfilePage()" title="Open Profile">
            <i class="fa-solid fa-house"></i>
        </button>
        <div class="search-box-wrapper">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="search-input" placeholder="Search..." onkeyup="filterItems()">
        </div>
        <button class="btn-add-action" onclick="handleTopAddButtonClick()" title="Add New">
            &#x2795;
        </button>
    </header>
    <p type="button" class="floating-message-btn" title="Open Messages" onclick="openChat()">
        <i class="fa-solid fa-comment-dots"></i>
    </p>
    <p type="button" class="floating-bell-btn" title="Notifications" onclick="openUsersPage()">
        <span>&#128276;</span>
    </p>
    <main class="main-container">
        <section id="view-all" class="view-section active">
            <div class="content-grid" id="all-list">
                <div class="item-card" data-title="water pump product" onclick="openItemDetails(this,'ITEM 1 (1 HP)','Subtitle: Product • ₹COST','High quality 1 HP copper winding heavy duty water pump suitable for domestic household usage.','Contact via WhatsApp','https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=500&q=80')">
                    <button class="card-edit-btn" onclick="openEditCardModal(event,this)"><i class="fa-solid fa-pen-to-square"></i></button>
                    <img src="https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=500&q=80" class="item-card-img" alt="Water Pump">
                    <div class="item-title">ITEM NO.1</div>
                    <div class="item-sub">Subtitle: Product • ₹COST</div>
                </div>
            </div>
        </section>
        <section id="view-services" class="view-section">
            <div class="content-grid" id="services-list">
                <div class="item-card" data-title="electrical fitting maintenance" onclick="openItemDetails(this,'SERVICE 1','Type: Electrical Maintenance','Complete house wiring, socket replacement, fan installation, and general electrical diagnostics by expert technicians.','Book Service','https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=500&q=80')">
                    <button class="card-edit-btn" onclick="openEditCardModal(event,this)"><i class="fa-solid fa-pen-to-square"></i></button>
                    <img src="https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=500&q=80" class="item-card-img" alt="Electrical Fitting">
                    <div class="item-title">SERVICE NO.1</div>
                    <div class="item-sub">Type of service</div>
                </div>
            </div>
        </section>
        <section id="view-vacancies" class="view-section">
            <div class="content-grid" id="vacancies-list">
                <div class="item-card" data-title="store helper helper" onclick="openItemDetails(this,'STORE HELPER','Salary: ₹12,000 / month','Eligibility: 10th Pass \\n\\nFull-time store helper needed for shop inventory management and local deliveries.','Apply Now','https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=500&q=80')">
                    <button class="card-edit-btn" onclick="openEditCardModal(event,this)"><i class="fa-solid fa-pen-to-square"></i></button>
                    <img src="https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=500&q=80" class="item-card-img" alt="Store Helper">
                    <div class="item-title">POST NO.1</div>
                    <div class="item-sub">Salary: ₹ / month</div>
                </div>
            </div>
        </section>
    </main>
'''

with open(path, 'a', encoding='utf-8') as f:
    f.write(body)
print(f'Body part 1 appended, file now: {os.path.getsize(path)} bytes')
