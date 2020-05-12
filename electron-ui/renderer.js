const { wallet_rpc_host_and_port } = require("./config");
var QRCode = require('qrcode');
var canvas = document.getElementById('qr_canvas');
const Dialogs = require('dialogs');
const dialogs = Dialogs();
const WebSocket = require('ws');
let chia_formatter = require('./chia');
const electron = require('electron');

// HTML
let top_link = document.querySelector('#top_link')
let send = document.querySelector('#send')
let farm_button = document.querySelector('#farm_block')
let new_address = document.querySelector('#new_address')
let copy = document.querySelector("#copy")
let receiver_address = document.querySelector("#receiver_puzzle_hash")
let amount = document.querySelector("#amount_to_send")
let table = document.querySelector("#tx_table").getElementsByTagName('tbody')[0]
let balance_textfield = document.querySelector('#balance_textfield')
let pending_textfield = document.querySelector('#pending_textfield')
let available_balance_textfield = document.querySelector('#available_balance_textfield')
let pending_balance_textfield = document.querySelector('#pending_balance_textfield')
let locklist_button = document.querySelector('#locklist_button')
let locklist_textfield = document.querySelector("#locklist_textfield")
let connection_textfield = document.querySelector('#connection_textfield')
let syncing_textfield = document.querySelector('#syncing_textfield')
let block_height_textfield = document.querySelector('#block_height_textfield')
let standard_wallet_balance = document.querySelector('#standard_wallet_balance')
let wallets_tab = document.querySelector('#wallets_tab')
const { get_query_variable } = require("./utils");
var g_wallets = {}
var pending_balances = {}

// UI checkmarks and lock icons
const green_checkmark = "<i class=\"icon ion-md-checkmark-circle-outline green\"></i>"
const red_checkmark = "<i class=\"icon ion-md-close-circle-outline red\"></i>"
const lock = "<i class=\"icon ion-md-lock\"></i>"
const checkmark = "<i class=\"icon ion-md-checkmark\"></i>"

// Global variables
var global_syncing = true
var global_sending_transaction = false

function create_side_wallet(id, href, wallet_name, wallet_description, wallet_amount, active) {
    var balance_id = "balance_wallet_" + id
    var avail_id = "avail_wallet_" + id
    var is_active = active ? "active" : "";
    href += "?wallet_id=" + id + "&testing=" + local_test
    const template = `<a class="nav-link d-flex justify-content-between align-items-center ${is_active}" data-toggle="pill"
              href="${href}" role="tab" aria-selected="true">
              <div class="d-flex">
                <img src="assets/img/circle-cropped.png" alt="btc">
                <div>
                  <h2>${wallet_name}</h2>
                  <p>${wallet_description}</p>
                </div>
              </div>
              <div>
                <p class="text-right" id="${balance_id}">0.00</p>
                <p class="text-right" id="${avail_id}"><i class="icon ion-md-checkmark"></i> 0.00</p>
              </div>
            </a>`
    return template
}

function create_wallet_button() {
    create_button = `<a class="nav-link d-flex justify-content-between align-items-center" data-toggle="pill" href="./create_wallet.html"
              role="tab" aria-selected="true">
              <div class="d-flex">
                <div>
                  <h2> + Create New Wallet</h2>
                </div>
              </div>
              <div>
                <p class="text-right"><i class="icon ion-md-plus"></i></p>
              </div>
            </a>`
    return create_button
}

var local_test = electron.remote.getGlobal('sharedObj').local_test;
var g_wallet_id = get_query_variable("wallet_id")

console.log("testing: " + local_test)
console.log("wallet_id: " + g_wallet_id)

if (local_test == false) {
    farm_button.style.visibility="hidden"
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

var ws = new WebSocket(wallet_rpc_host_and_port);

function set_callbacks(socket) {
    /*
    Sets callbacks for socket events
    */

    socket.on('open', function open() {
        var msg = {"command": "start_server"}
        ws.send(JSON.stringify(msg));
    });

    socket.on('message', function incoming(incoming) {
        var message = JSON.parse(incoming);
        var command = message["command"];
        var data = message["data"];

        if (command == "start_server") {
            //get_wallets();
            get_wallet_summaries();
            get_transactions();
            get_wallet_balance(g_wallet_id);
            get_height_info();
            get_sync_status();
            get_connection_info();
            connection_checker();
        } else if (command == "get_next_puzzle_hash") {
            get_new_puzzlehash_response(data);
        } else if (command == "get_wallet_balance") {
            get_wallet_balance_response(data);
        } else if (command == "send_transaction") {
            send_transaction_response(data);
        } else if (command == "get_transactions") {
            get_transactions_response(data);
        } else if (command == "state_changed") {
            handle_state_changed(data);
        } else if (command == "get_connection_info") {
            get_connection_info_response(data)
        } else if (command == "get_height_info") {
            get_height_info_response(data)
        } else if (command == "get_sync_status") {
            get_sync_status_response(data)
        } else if (command == "get_wallets") {
            get_wallets_response(data)
        } else if (command == "get_wallet_summaries") {
            get_wallet_summaries_response(data)
        }
    });

    socket.on('error', function clear() {
        console.log("Not connected, reconnecting");
        connect(1000);
    });
}

set_callbacks(ws);

async function connect(timeout) {
    /*
    Tries to connect to the host after a timeout
    */
    await sleep(timeout);
    ws = new WebSocket(wallet_rpc_host_and_port);
    set_callbacks(ws);
}

send.addEventListener('click', () => {
    /*
    Called when send button in ui is pressed.
    */

    if (global_syncing) {
        dialogs.alert("Can't send transactions while syncing.", ok => {});
        return
    }
    if (global_sending_transaction) {
        return;
    }

    try {
        puzzle_hash = receiver_address.value;
        if (puzzle_hash.includes("colour")){
          dialogs.alert("Error: Cannot send chia to coloured address. Please enter a chia address.")
          return
        } else if (puzzle_hash.substring(0, 12) == "chia_addr://") {
          puzzle_hash = puzzle_hash.substring(12)
        }
        if (puzzle_hash.startsWith("0x") || puzzle_hash.startsWith("0X")) {
            puzzle_hash = puzzle_hash.substring(2);
        }
        if (puzzle_hash.length != 64) {
            alert("Please enter a 32 byte puzzle hash in hexadecimal format");
            return;
        }
        amount_value = parseFloat(Number(amount.value));
        if (isNaN(amount_value)) {
            alert("Please enter a valid numeric amount");
            return;
        }
        global_sending_transaction = true;
        send.disabled = true;
        send.innerHTML = "SENDING...";
        mojo_amount = chia_formatter(amount_value, 'chia').to('mojo').value()

        data = {
            "puzzle_hash": puzzle_hash,
            "amount": mojo_amount,
            "wallet_id": g_wallet_id
        }

        request = {
            "command": "send_transaction",
            "data": data
        }
        json_data = JSON.stringify(request);
        ws.send(json_data);
    } catch (error) {
        alert("Error sending the transaction").
        global_sending_transaction = false;
        send.disabled = false;
        send.innerHTML = "SEND";
    }
})

farm_button.addEventListener('click', () => {
    /*
    Called when send button in ui is pressed.
    */
    puzzle_hash = receiver_address.value;
    if (puzzle_hash == "") {
        dialogs.alert("Specify puzzle_hash for coinbase reward", ok => {
        })
        return
    } else if (puzzle_hash.includes("colour")){
      dialogs.alert("Please enter a chia address for coinbase reward.")
      return
    } else if (puzzle_hash.substring(0, 12) == "chia_addr://") {
      puzzle_hash = puzzle_hash.substring(12)
    }

    data = {
        "puzzle_hash": puzzle_hash,
        "wallet_id": g_wallet_id,
    }
    request = {
        "command": "farm_block",
        "data": data
    }
    json_data = JSON.stringify(request);
    ws.send(json_data);
    //dialogs.alert("Farmed new block!", ok => {});
})

function send_transaction_response(response) {
    /*
    Called when response is received for send_transaction request
    */
   console.log(JSON.stringify(response));
   status = response["status"];
   if (status === "SUCCESS") {
       dialogs.alert("Transaction accepted succesfully into the mempool.", ok => {});
       receiver_address.value = "";
       amount.value = "";
   } else if (status === "PENDING") {
       dialogs.alert("Transaction is pending acceptance into the mempool. Reason: " + response["reason"], ok => {});
       receiver_address.value = "";
       amount.value = "";
   } else if (status === "FAILED") {
       dialogs.alert("Transaction failed. Reason: " + response["reason"], ok => {});
   }
    global_sending_transaction = false;
    send.disabled = false;
    send.innerHTML = "SEND";
}

new_address.addEventListener('click', () => {
    /*
    Called when new address button is pressed.
    */
    get_new_puzzlehash(0);
})

copy.addEventListener("click", () => {
    /*
    Called when copy button is pressed
    */
    let puzzle_holder = document.querySelector("#puzzle_holder");
    puzzle_holder.select();
    /* Copy the text inside the text field */
    document.execCommand("copy");
})

async function get_new_puzzlehash() {
    if (global_syncing) {
        alert("Cannot create address while syncing.")
        return;
    }

    /*
    Sends websocket request for new puzzle_hash
    */
    data = {
    "wallet_id": g_wallet_id,
    }

    request = {
        "command": "get_next_puzzle_hash",
        "data": data
    }

    json_data = JSON.stringify(request);
    ws.send(json_data);
}

function get_new_puzzlehash_response(response) {
    /*
    Called when response is received for get_new_puzzle_hash request
    */
    let puzzle_holder = document.querySelector("#puzzle_holder");
    puzzle_hash = "chia_addr://"
    puzzle_hash = puzzle_hash.concat(response["puzzlehash"]);
    puzzle_holder.value = puzzle_hash
    QRCode.toCanvas(canvas, response["puzzlehash"], function (error) {
    if (error) console.error(error)
    })
}

async function get_wallet_balance(id) {
    /*
    Sends websocket request to get wallet balance
    */
    data = {
        "wallet_id": id,
    }

    request = {
        "command": "get_wallet_balance",
        "data": data
    }

    json_data = JSON.stringify(request);
    ws.send(json_data);
}

function get_wallet_balance_response(response) {
    if (response["success"]) {
        // total amount of coins
        var confirmed_bal = parseInt(response["confirmed_wallet_balance"])
        // total amount - coins that are removed in transaction + coins that are added in transaction (change)
        var unconfirmed_bal = parseInt(response["unconfirmed_wallet_balance"])
        // total amount - coins locked in transactions - coins that are frozen
        var spendable_bal = parseInt(response["spendable_balance"])
        // coins that are still in coinbase freeze
        var frozen_bal = parseInt(response["frozen_balance"])
        // total amount - coins that are removed in transaction
        var pend_tx_bal = parseInt(response["pending_tx_balance"])

        var pendspends = confirmed_bal - unconfirmed_bal
        var change = pend_tx_bal

        var wallet_id = response["wallet_id"]
        console.log("wallet_id = " + wallet_id + ", confirmed_bal: " + confirmed_bal + ", unconfirmed_bal: " + unconfirmed_bal + ", spendable_bal: " + spendable_bal + ", frozen: " + frozen_bal + ", pending_tx_bal: " + pend_tx_bal)

        chia_confirmed = chia_formatter(confirmed_bal, 'mojo').to('chia').toString()
        chia_unconfirmed = chia_formatter(unconfirmed_bal, 'mojo').to('chia').toString()
        chia_spendable = chia_formatter(spendable_bal, 'mojo').to('chia').toString()
        chia_frozen = chia_formatter(frozen_bal, 'mojo').to('chia').toString()
        chia_change = chia_formatter(change, 'mojo').to('chia').toString()
        chia_pendspends = chia_formatter(pendspends, 'mojo').to('chia').toString()

        chia_pendspends = -1 * chia_pendspends

        if (g_wallet_id == wallet_id) {
          pending_balances = {"rewards": chia_frozen, "spends": chia_pendspends, "change": chia_change}
        }

        wallet_balance_holder = document.querySelector("#" + "balance_wallet_" + wallet_id )
        wallet_avail_holder = document.querySelector("#" + "avail_wallet_" + wallet_id )

        if (g_wallet_id == wallet_id) {
            balance_textfield.innerHTML = chia_confirmed + " CH"
            if (chia_spendable < 0) {
              available_balance_textfield.innerHTML = "0 CH"
            } else {
              available_balance_textfield.innerHTML = chia_spendable + " CH"
            }
            pending_balance_textfield.innerHTML = lock + chia_unconfirmed + " CH"
          }

        if (wallet_balance_holder) {
            wallet_balance_holder.innerHTML = chia_confirmed.toString() + " CH"
        }
        if (wallet_avail_holder) {
          if (chia_spendable < 0) {
            wallet_avail_holder.innerHTML = checkmark + " 0 CH"
          } else {
            wallet_avail_holder.innerHTML = checkmark + " " + chia_spendable.toString() + " CH"
          }
        }
    }
}

async function get_transactions() {
    /*
    Sends websocket request to get transactions
    */

    data = {
        "wallet_id": g_wallet_id,
    }

    request = {
        "command": "get_transactions",
        "data": data,
    }

    json_data = JSON.stringify(request);
    ws.send(json_data);
}

var glob_counter = 0

function get_transactions_response(response) {
    /*
    Called when response is received for get_transactions request
    */
    if (global_syncing) {
        glob_counter++;
        if ((glob_counter % 10) == 0) {

        } else {
            return
        }
    }

    clean_table()

    for (var i = 0; i < response.txs.length; i++) {
        var tx = response.txs[i];
        var row = table.insertRow(0);
        var cell_type = row.insertCell(0);
        var cell_to = row.insertCell(1);
        var cell_date = row.insertCell(2);
        var cell_status = row.insertCell(3);
        var cell_amount = row.insertCell(4);
        var cell_fee = row.insertCell(5);
        //type of transaction
        if (tx["incoming"]) {
            cell_type.innerHTML = "Incoming";
        } else {
            cell_type.innerHTML = "Outgoing";
        }
        // Receiving puzzle hash
        cell_to.innerHTML = tx["to_puzzle_hash"];

        // Date
        var date = new Date(parseInt(tx["created_at_time"]) * 1000);
        cell_date.innerHTML = "" + date;

        // Confirmation status
        if (tx["confirmed"]) {
             index = tx["confirmed_at_index"];
             cell_status.innerHTML = "Confirmed" + green_checkmark +"</br>" + "Block: " + index;
        } else {
             cell_status.innerHTML = "Pending " + red_checkmark;
        }

        // Amount and Fee
        var amount = parseInt(tx["amount"])
        var fee = parseInt(tx["fee_amount"])
        cell_amount.innerHTML = " " + chia_formatter(amount, 'mojo').to('chia').toString() + " CH"
        cell_fee.innerHTML = " " + chia_formatter(fee, 'mojo').to('chia').toString() + " CH"
    }
}

async function get_height_info() {
    /*
    Sends websocket request to blockchain height
    */
    data = {
        "command": "get_height_info",
    }
    json_data = JSON.stringify(data);
    ws.send(json_data);
}

async function get_sync_status() {
    /*
    Sends websocket request to see if wallet is syncing currently
    */
    data = {
        "command": "get_sync_status",
    }
    json_data = JSON.stringify(data);
    ws.send(json_data);
}

async function connection_checker() {
    try {
        await sleep(5000);
        await get_connection_info()
        connection_checker()
    } catch (error) {
        console.error(error);
        connection_textfield.innerHTML = "Not Connected";
        connection_checker()
    }
}

async function get_connection_info() {
    /*
    Sends websocket request to get list of connections
    */
    data = {
        "command": "get_connection_info",
    }
    json_data = JSON.stringify(data);
    ws.send(json_data);
}

function get_height_info_response(response) {
    height = response["height"]
    block_height_textfield.innerHTML = "" + height;
}

function get_sync_status_response(response) {
    syncing = response["syncing"]
    global_syncing = syncing
    if (syncing) {
        syncing_textfield.innerHTML = "Syncing in progress";
    } else {
        get_transactions()
        syncing_textfield.innerHTML = "Synced";
    }
}

async function get_connection_info_response(response) {
    connections = response["connections"]
    count = connections.length;
    if (count == 0) {
        connection_textfield.innerHTML = "Not Connected"
    } else if (count == 1) {
        connection_textfield.innerHTML = connections.length + " connection"
    } else {
        connection_textfield.innerHTML = connections.length + " connections"
    }
}

function handle_state_changed(data) {
    state = data["state"]
    console.log("State changed", state)
    if(global_syncing) {
        get_wallet_balance(g_wallet_id)
        get_sync_status()
        get_height_info()
        return;
    }

    if (state == "coin_removed") {
        get_transactions()
        get_wallet_balance(g_wallet_id)
    } else if (state == "coin_added") {
        get_transactions()
        get_wallet_balance(g_wallet_id)
        update_balance_for_all_wallets()
    } else if (state == "pending_transaction") {
        get_transactions()
        get_wallet_balance(g_wallet_id)
    } else if (state == "tx_sent") {
        get_transactions()
        get_wallet_balance(g_wallet_id)
    } else if (state == "balance_changed") {
        get_wallet_balance(g_wallet_id)
        update_balance_for_all_wallets()
    } else if (state == "sync_changed") {
        get_sync_status()
    } else if (state == "new_block") {
        get_height_info()
    } else if (state == "reorg") {
        get_transactions()
        get_wallet_balance(g_wallet_id)
        get_height_info()
        get_sync_status()
        update_balance_for_all_wallets()
    }
}

function update_balance_for_all_wallets() {
    for (var i = 0; i < g_wallets.length; i++) {
        var wallet = g_wallets[i];
        var id = wallet["id"]
        get_wallet_balance(id)
    }
}

function get_wallets() {
    /*
    Sends websocket request to get list of all wallets available
    */
    data = {
        "command": "get_wallets",
    }
    json_data = JSON.stringify(data);
    ws.send(json_data);
}

function get_wallets_response(data) {
    new_innerHTML = ""
    const wallets = data["wallets"]
    g_wallets = wallets

    for (var i = 0; i < wallets.length; i++) {
        var wallet = wallets[i];
        var type = wallet["type"]
        var id = wallet["id"]
        var name = wallet["name"]
        get_wallet_balance(id)
        //href, wallet_name, wallet_description, wallet_amount
        console.log("type is " + type)
        var href = ""
        if (type == "STANDARD_WALLET") {
            href = "wallet-dark.html"
        } else if (type == "RATE_LIMITED") {
            href = "rl_wallet/rl_wallet.html"
        } else if (type == "COLOURED_COIN") {
            href = "cc_wallet/cc_wallet.html"
        }

        if (id == g_wallet_id) {
            new_innerHTML += create_side_wallet(id, href, name, type, 0, true)
        } else {
            new_innerHTML += create_side_wallet(id, href, name, type, 0, false)
        }

    }
    new_innerHTML += create_wallet_button()
    wallets_tab.innerHTML = new_innerHTML
}

function get_wallet_summaries() {
  /*
  Sends websocket request to get wallet summaries
  */
  data = {
      "info": "123",
  }

  request = {
      "command": "get_wallet_summaries",
      "data": data
  }

  json_data = JSON.stringify(request);
  ws.send(json_data);
}

function get_wallet_summaries_response(data){
  // {id: {"type": type, "balance": balance, "name": name, "colour": colour}}
  // {id: {"type": type, "balance": balance}}
  var new_innerHTML = ""
  for (var i in data) {
      var wallet = data[i];
      var type = wallet["type"]
      var id = i
      var name = wallet["type"]

      get_wallet_balance(id)
      //href, wallet_name, wallet_description, wallet_amount
      var href = ""
      if (type == "STANDARD_WALLET") {
          href = "./wallet-dark.html"
          name = "Chia Wallet"
          type = "Chia"
      } else if (type == "RATE_LIMITED") {
          href = "rl_wallet/rl_wallet.html"
      } else if (type == "COLOURED_COIN") {
          href = "cc_wallet/cc_wallet.html"
          name = "CC Wallet"
          type = wallet["name"]
          if (type.length > 18) {
            type = type.substring(0,18);
            type = type.concat("...")
          }
      }

      if (id == g_wallet_id) {
          new_innerHTML += create_side_wallet(id, href, name, type, 0, true)
      } else {
          new_innerHTML += create_side_wallet(id, href, name, type, 0, false)
      }

  }
  new_innerHTML += create_wallet_button()
  wallets_tab.innerHTML = new_innerHTML
}

locklist_button.addEventListener('click', function() {
    /*
    Called when locklist button in ui is pressed.
    */

    get_wallet_balance(g_wallet_id)
    rewards = pending_balances["rewards"]
    spends = pending_balances["spends"]
    change = pending_balances["change"]
    locklist_textfield.innerHTML = `<ul>
    <li class="d-flex justify-content-between align-items-center">
      <div class="d-flex align-items-center">
        <i class="icon ion-md-gift"></i>
        <h2>Pending Farming Rewards</h2>
      </div>
      <div>
        <h3><i class="icon ion-md-lock"></i>${rewards} CH</h3>
      </div>
    </li>
    <li class="d-flex justify-content-between align-items-center">
      <div class="d-flex align-items-center">
        <i class="icon ion-md-paper-plane"></i>
        <h2>Pending From Transactions</h2>
      </div>
      <div>
        <h3><i class="icon ion-md-lock"></i>${spends} CH</h3>
      </div>
    </li>
    <li class="d-flex justify-content-between align-items-center">
      <div class="d-flex align-items-center">
        <i class="icon ion-md-return-left"></i>
        <h2>Pending Transaction Change</h2>
      </div>
      <div>
        <h3><i class="icon ion-md-lock"></i>${change} CH</h3>
      </div>
    </li>
    </ul>`

    var content = this.nextElementSibling;
    if (content.style.display === "block") {
      content.style.display = "none";
    } else {
      content.style.display = "block";
    }
    if (content.style.maxHeight) {
      content.style.maxHeight = null;
    } else {
      content.style.maxHeight = content.scrollHeight + "px";
    }
    this.classList.toggle("active");
  }
)

function clean_table() {
    while (table.rows.length > 0) {
        table.deleteRow(0);
    }
}

clean_table();
