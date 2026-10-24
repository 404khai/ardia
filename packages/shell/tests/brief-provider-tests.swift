extension BriefChatGPT {
  func testCrypto() throws {
    let samples = try (0..<32).map { _ in try random() }
    precondition(Set(samples).count == samples.count)
    precondition(samples.allSatisfy { $0.count == 43 && !$0.contains("=") })
    let data = Data((0..<256).map(UInt8.init))
    let roundtrip = try decode(encode(data))
    precondition(roundtrip == data)
    precondition(der(0x30, integer(Data([0x80])) + integer(Data([3]))) == Data([0x30, 0x07, 0x02, 0x02, 0, 0x80, 0x02, 0x01, 0x03]))
    precondition(der(0x30, Data(repeating: 0, count: 256)).prefix(4) == Data([0x30, 0x82, 0x01, 0]))
    let privateKey = SecKeyCreateRandomKey([kSecAttrKeyType as String: kSecAttrKeyTypeRSA, kSecAttrKeySizeInBits as String: 2048] as CFDictionary, nil)!
    let publicKey = SecKeyCopyPublicKey(privateKey)!
    let exported = SecKeyCopyExternalRepresentation(publicKey, nil)! as Data
    let restored = SecKeyCreateWithData(exported as CFData, [kSecAttrKeyType as String: kSecAttrKeyTypeRSA, kSecAttrKeyClass as String: kSecAttrKeyClassPublic] as CFDictionary, nil)!
    let message = Data("test".utf8)
    let signature = SecKeyCreateSignature(privateKey, .rsaSignatureMessagePKCS1v15SHA256, message as CFData, nil)!
    precondition(SecKeyVerifySignature(restored, .rsaSignatureMessagePKCS1v15SHA256, message as CFData, signature, nil))
  }
}

@main struct Tests {
  private static func assertDisconnected(_ provider: BriefChatGPT) async throws {
    let status = try await provider.status()
    precondition(status["connected"] as? Bool == false)
  }
  static func main() async throws {
    let provider = BriefChatGPT()
    try await provider.testCrypto()
    try await assertDisconnected(provider)
    let result = try await provider.begin()
    let url = URLComponents(string: result["authorizationUrl"]!)!
    let query = Dictionary(uniqueKeysWithValues: url.queryItems!.map { ($0.name, $0.value!) })
    precondition(url.host == "auth.openai.com")
    precondition(query["client_id"] == "dynamic_agent_client")
    precondition(query["code_challenge_method"] == "S256")
    precondition(query["state"]!.count == 43 && query["nonce"]!.count == 43)
    let callback = URLComponents(string: query["redirect_uri"]!)!
    precondition(callback.host == "127.0.0.1" && callback.path == "/auth/callback")
    let invalid = URL(string: "\(query["redirect_uri"]!)?state=invalid&code=fake&client_id=bad")!
    for _ in 0..<12 {
      let (_, response) = try await URLSession.shared.data(from: invalid)
      precondition((response as! HTTPURLResponse).statusCode == 400)
    }
    let completion = Task { try await provider.complete() }
    await provider.cancel()
    do {
      _ = try await completion.value
      fatalError("Cancelled callback incorrectly succeeded")
    } catch {}
    try await assertDisconnected(provider)
    let second = try await provider.begin()
    let params = URLComponents(string: second["authorizationUrl"]!)!.queryItems!
    let fields = Dictionary(uniqueKeysWithValues: params.map { ($0.name, $0.value!) })
    let fake = URL(string: "\(fields["redirect_uri"]!)?state=\(fields["state"]!)&code=fake&client_id=dynamic_agent_client")!
    _ = try await URLSession.shared.data(from: fake)
    do {
      _ = try await provider.complete()
      fatalError("Invalid dynamic client incorrectly accepted")
    } catch {}
    try await assertDisconnected(provider)
    do {
      _ = try await provider.generate("bad JSON")
      fatalError("Invalid context incorrectly accepted")
    } catch {}
    var store = try BriefSecrets.load()
    store.active = "test"
    store.accounts["test"] = BriefCredential(clientId: "test", subject: "test", email: "test@example.invalid", accessToken: "fake-test-token", refreshToken: nil, idToken: nil, expiresAt: Date().timeIntervalSince1970 + 3600, scopes: ["chatgpt.tokens.use.direct", "resource.invoke"])
    try BriefSecrets.save(store)
    let generation = Task { try await provider.generate("{\"context\":\"private fixture\"}") }
    let requestsPath = ProcessInfo.processInfo.environment["ARDIA_BRIEF_TEST_REQUESTS"]!
    let deadline = Date().addingTimeInterval(10)
    while !FileManager.default.fileExists(atPath: requestsPath) {
      if Date() > deadline { fatalError("The model lookup did not start before the deadline") }
      try await Task.sleep(nanoseconds: 20_000_000)
    }
    await provider.cancelGeneration()
    do {
      _ = try await generation.value
      fatalError("Generation continued after consent changed")
    } catch {}
    let requests = try String(contentsOfFile: requestsPath, encoding: .utf8)
    precondition(requests.contains("/v1/models"))
    precondition(!requests.contains("/v1/responses"))
    store.accounts.removeAll()
    store.active = nil
    try BriefSecrets.save(store)
    print("PASS consent cancellation during catalog lookup prevents private context submission")
    print("PASS secure random, PKCE, RSA compatibility, loopback bind/path/state, cancellation, invalid client rejection, no false connection, JSON validation")
  }
}
