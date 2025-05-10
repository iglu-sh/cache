pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});

pm.test("Body is parseable", function(){
    pm.response.to.be.ok;
    pm.response.to.have.jsonBody;
})
pm.test("Body has correct format", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData.githubUsername).to.be.a('string');
    pm.expect(jsonData.isPublic).to.be.a('boolean');
    pm.expect(jsonData.name).to.be.a('string')
    pm.expect(jsonData.permission).to.be.a('string')
    pm.expect(jsonData.preferredCompressionMethod).to.be.a('string')
    pm.expect(jsonData.preferredCompressionMethod).eqls("XZ")
    pm.expect(jsonData.publicSigningKeys).to.be.a('Array')
    pm.expect(jsonData.uri).to.be.a("string")
});