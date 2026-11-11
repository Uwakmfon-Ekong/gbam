#![cfg(test)]
extern crate std;

use super::*;
use ed25519_dalek::{Signer, SigningKey};
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    token::{Client as TokenClient, StellarAssetClient},
    Bytes,
};
use std::vec::Vec;

struct Setup<'a> {
    env: Env,
    escrow: GiftEscrowClient<'a>,
    token: TokenClient<'a>,
    sender: Address,
    receiver: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000_000);
    let issuer = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(issuer);
    let token = TokenClient::new(&env, &sac.address());
    let sender = Address::generate(&env);
    let receiver = Address::generate(&env);
    StellarAssetClient::new(&env, &sac.address()).mint(&sender, &1_000_0000000);
    let id = env.register(GiftEscrow, (sac.address(),));
    let escrow = GiftEscrowClient::new(&env, &id);
    Setup { env, escrow, token, sender, receiver }
}

fn link_key() -> SigningKey {
    SigningKey::generate(&mut rand::rngs::OsRng)
}

fn pubkey(env: &Env, k: &SigningKey) -> BytesN<32> {
    BytesN::from_array(env, &k.verifying_key().to_bytes())
}

/// What the receiver's phone does: sign the XDR of their own address with the link key.
fn sign_for(env: &Env, k: &SigningKey, to: &Address) -> BytesN<64> {
    let msg: Bytes = to.clone().to_xdr(env);
    let raw: Vec<u8> = msg.iter().collect();
    BytesN::from_array(env, &k.sign(&raw).to_bytes())
}

#[test]
fn create_then_claim_moves_money_to_receiver() {
    let s = setup();
    let k = link_key();
    let link = pubkey(&s.env, &k);
    let expires = s.escrow.create(&s.sender, &link, &10_0000000, &86_400);
    assert_eq!(expires, 1_000_000 + 86_400);
    assert_eq!(s.token.balance(&s.escrow.address), 10_0000000);
    assert_eq!(s.escrow.get(&link).unwrap().amount, 10_0000000);

    let sig = sign_for(&s.env, &k, &s.receiver);
    assert_eq!(s.escrow.claim(&link, &s.receiver, &sig), 10_0000000);
    assert_eq!(s.token.balance(&s.receiver), 10_0000000);
    assert_eq!(s.token.balance(&s.escrow.address), 0);
    assert!(s.escrow.get(&link).is_none());
}

#[test]
fn signature_for_someone_else_cannot_redirect_the_gift() {
    let s = setup();
    let k = link_key();
    let link = pubkey(&s.env, &k);
    s.escrow.create(&s.sender, &link, &5_0000000, &60);
    let thief = Address::generate(&s.env);
    let sig_for_receiver = sign_for(&s.env, &k, &s.receiver);
    assert!(s.escrow.try_claim(&link, &thief, &sig_for_receiver).is_err());
    // A random key can't claim either.
    let other = link_key();
    assert!(s.escrow.try_claim(&link, &thief, &sign_for(&s.env, &other, &thief)).is_err());
    assert_eq!(s.token.balance(&s.escrow.address), 5_0000000);
}

#[test]
fn cannot_claim_twice() {
    let s = setup();
    let k = link_key();
    let link = pubkey(&s.env, &k);
    s.escrow.create(&s.sender, &link, &5_0000000, &60);
    let sig = sign_for(&s.env, &k, &s.receiver);
    s.escrow.claim(&link, &s.receiver, &sig);
    assert_eq!(s.escrow.try_claim(&link, &s.receiver, &sig), Err(Ok(Error::NotFound.into())));
}

#[test]
fn refund_only_after_window_and_claim_blocked_after() {
    let s = setup();
    let k = link_key();
    let link = pubkey(&s.env, &k);
    s.escrow.create(&s.sender, &link, &7_0000000, &120);
    assert_eq!(s.escrow.try_refund(&link), Err(Ok(Error::NotExpired.into())));

    s.env.ledger().set_timestamp(1_000_000 + 120);
    let sig = sign_for(&s.env, &k, &s.receiver);
    assert_eq!(s.escrow.try_claim(&link, &s.receiver, &sig), Err(Ok(Error::Expired.into())));

    let before = s.token.balance(&s.sender);
    assert_eq!(s.escrow.refund(&link), 7_0000000);
    assert_eq!(s.token.balance(&s.sender), before + 7_0000000);
    assert_eq!(s.escrow.try_refund(&link), Err(Ok(Error::NotFound.into())));
}

#[test]
fn rejects_bad_inputs() {
    let s = setup();
    let link = pubkey(&s.env, &link_key());
    assert_eq!(s.escrow.try_create(&s.sender, &link, &0, &60), Err(Ok(Error::BadAmount.into())));
    assert_eq!(s.escrow.try_create(&s.sender, &link, &1, &0), Err(Ok(Error::BadWindow.into())));
    s.escrow.create(&s.sender, &link, &1, &60);
    assert_eq!(s.escrow.try_create(&s.sender, &link, &1, &60), Err(Ok(Error::AlreadyExists.into())));
}

#[test]
fn create_requires_sender_auth() {
    let s = setup();
    let link = pubkey(&s.env, &link_key());
    s.escrow.create(&s.sender, &link, &1_0000000, &60);
    let auths = s.env.auths();
    assert_eq!(auths[0].0, s.sender);
}

/// The app signs `new Address(to).toScVal().toXDR()` in JavaScript. Make sure the contract
/// hashes exactly the same bytes, for both G… accounts and C… contracts (smart wallets).
#[test]
fn address_xdr_matches_javascript_sdk() {
    let env = Env::default();
    let cases = [
        (
            "GDVEU3DD4KOFECV66VIHWEZOYX4ZKR3WV27L464SIIPOU2IUI3JCZA57",
            "000000120000000000000000ea4a6c63e29c520abef5507b132ec5f9954776aebebe7b92421eea691446d22c",
        ),
        (
            "CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC",
            "0000001200000001d7928b72c2703ccfeaf7eb9ff4ef4d504a55a8b979fc9b450ea2c842b4d1ce61",
        ),
    ];
    for (strkey, js_hex) in cases {
        let a = Address::from_str(&env, strkey);
        let bytes: Vec<u8> = a.to_xdr(&env).iter().collect();
        let hex: std::string::String = bytes.iter().map(|b| std::format!("{:02x}", b)).collect();
        assert_eq!(hex, js_hex, "XDR mismatch for {strkey}");
    }
}
