const jwt = require('jsonwebtoken');

exports.main = function(event, context, callback) {
    try {
        let token = event.authorizationToken.split("Bearer ")[1];
        let verified = jwt.verify(token, process.env.JWT_SECRET);
        
        if (verified) {
            callback(null, validateAccess(verified, event.methodArn));
        } else {
            callback("Unauthorized");
        }
    } catch(error) {
        callback("Error: Invalid token");
    }
}

const generatePolicy = function(principalId, resource) {
    var authResponse = {
        principalId: principalId
    };
    
    if (resource) {
        authResponse.policyDocument = {
            Version: '2012-10-17',
            Statement: [
                {
                    Action: 'execute-api:Invoke',
                    Effect: 'Allow',
                    Resource: resource
                }
            ]
        }
    }

    return authResponse;
}

const validateAccess = function(tokenPayload, methodArn) {
    let policy = null;
    console.log("[TOKEN-PAYLOAD]", tokenPayload);
    if (tokenPayload) {
        policy = generatePolicy(tokenPayload.sub, methodArn);
        // TODO: extend the validation: include checks for the method(s) and path(s) based on the user's role(s) from the token payload -- sample below
        if (tokenPayload.Role?.includes('SYSADMIN')) {
            // admin-access
            policy.policyDocument.Statement.push({
                Action: 'lambda:*',
                Effect: 'Allow',
                Resource: '*' // TODO: be more specific
            });
            policy.policyDocument.Statement.push({
                Action: 's3:*',
                Effect: 'Allow',
                Resource: '*' // TODO: be more specific
            });
        } else if (tokenPayload.Role?.includes('DEV')) {
            // developer-access
            policy.policyDocument.Statement.push({
                Action: 'lambda:Invoke',
                Effect: 'Allow',
                Resource: '*' // TODO: be more specific
            });
            policy.policyDocument.Statement.push({
                Action: [
                    's3:GetObject',
                    's3:PutObject'
                ],
                Effect: 'Allow',
                Resource: '*' // TODO: be more specific
            });
        } else {
            // end-user access
            policy.policyDocument.Statement.push({
                Action: 'lambda:Invoke',
                Effect: 'Allow',
                Resource: '*' // TODO: be more specific
            });
            policy.policyDocument.Statement.push({
                Action: [
                    's3:GetObject'
                ],
                Effect: 'Allow',
                Resource: '*' // TODO: be more specific
            });
        }
    }
    console.log('[DYNAMIC-POLICY]', JSON.stringify((policy)));
    return policy;
}
