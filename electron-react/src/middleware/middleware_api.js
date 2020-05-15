import {
    get_puzzle_hash, format_message,
    incomingMessage, get_balance_for_wallet, get_transactions,
    get_height_info, get_sync_status, get_connection_info,
    get_colour_info, get_colour_name
} from '../modules/message';

import {createState} from '../modules/createWalletReducer'
import { offerParsed, resetTrades } from '../modules/TradeReducer';
import { openDialog } from '../modules/dialogReducer';



export const handle_message = (store, payload) => {
    store.dispatch(incomingMessage(payload.command, payload.data))
    if (payload.command == "start_server") {
        console.log("fetch state")
        store.dispatch(format_message("get_public_keys", {}))
    }
    else if (payload.command == "log_in") {
        store.dispatch(format_message("get_wallets", {}))
        store.dispatch(get_height_info())
        store.dispatch(get_sync_status())
        store.dispatch(get_connection_info())
    }
    else if (payload.command == "add_key") {
        if (payload.data.success) {
            store.dispatch(format_message("get_wallets", {}))
            store.dispatch(format_message("get_public_keys", {}))
        }
    }
    else if (payload.command == "delete_key") {
        if (payload.data.success) {
            store.dispatch(format_message("get_public_keys", {}))
        }
    }
    else if (payload.command == "delete_all_keys") {
        if (payload.data.success) {
            store.dispatch(format_message("get_public_keys", {}))
        }
    }
    else if (payload.command == "get_wallets") {
        if (payload.data.success) {
            const wallets = payload.data.wallets
            console.log(wallets)
            wallets.map((wallet) => {
                store.dispatch(get_balance_for_wallet(wallet.id))
                store.dispatch(get_transactions(wallet.id))
                store.dispatch(get_puzzle_hash(wallet.id))
                if (wallet.type == "COLOURED_COIN") {
                    store.dispatch(get_colour_name(wallet.id))
                    store.dispatch(get_colour_info(wallet.id))
                }
            })
        }
    } else if (payload.command == "state_changed") {
        console.log(payload.data.state)
        console.log(payload)
        const state = payload.data.state
        if (state === "coin_added" || state === "coin_removed") {
            var wallet_id = payload.data.wallet_id
            console.log("WLID " + wallet_id)
            store.dispatch(get_balance_for_wallet(wallet_id))
            store.dispatch(get_transactions(wallet_id))
        } else if (state === "sync_changed") {
            store.dispatch(get_sync_status())
        } else if (state === "new_block") {
            store.dispatch(get_height_info())
        } else if (state === 'pending_transaction') {
            var wallet_id = payload.data.wallet_id
            store.dispatch(get_balance_for_wallet(wallet_id))
            store.dispatch(get_transactions(wallet_id))
        }
    } else if (payload.command === "create_new_wallet") {
        if (payload.data.success) {
            store.dispatch(format_message("get_wallets", {}))
        }
        store.dispatch(createState(true, false))
    }  else if (payload.command === "cc_set_name") {
        if (payload.data.success) {
            const wallet_id = payload.data.wallet_id
            store.dispatch(get_colour_name(wallet_id))
        }
    } else if (payload.command === "get_discrepancies_for_offer") {
        if (payload.data.success) {
            store.dispatch(offerParsed(payload.data.discrepancies))
        }
    } else if (payload.command === "respond_to_offer") {
        if (payload.data.success) {
            store.dispatch(openDialog("Success!", "Offer accepted"))
        }
        store.dispatch(resetTrades())
    }
    if (payload.data.success == false) {
        if (payload.data.reason) {
            store.dispatch(openDialog("Error?", payload.data.reason))
        }
    }

    console.log(payload)
}