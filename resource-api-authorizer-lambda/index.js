const jwt = require('jsonwebtoken');

exports.main = function(event, context, callback) {
    try {
        let token = event.authorizationToken.replace('Bearer ', '');
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
    authResponse.policyDocument = {
        Version: '2012-10-17',
        Statement: [
            {
                Action: 'execute-api:Invoke',
                Effect: 'Allow',
                Resource: resource || '*'
            }
        ]
    }
    return authResponse;
}

const validateAccess = function(tokenPayload, resource) {
    let policy = null;
    console.log("[TOKEN-PAYLOAD]", tokenPayload);
    if (tokenPayload) {
        policy = generatePolicy(tokenPayload.sub, resource);
        if (tokenPayload.Role?.includes('SYSADMIN')) {
            // admin-access
            policy.policyDocument.Statement.push({
                Action: 'lambda:*',
                Effect: 'Allow',
                Resource: process.env.LAMBDA_API_ARN || '*'
            });
            policy.policyDocument.Statement.push({
                Action: 's3:*',
                Effect: 'Allow',
                Resource: process.env.S3_CONTENT_ARN || '*'
            });
        } else if (tokenPayload.Role?.includes('DEV')) {
            // developer-access
            policy.policyDocument.Statement.push({
                Action: 'lambda:InvokeFunction',
                Effect: 'Allow',
                Resource: process.env.LAMBDA_API_ARN || '*'
            });
            policy.policyDocument.Statement.push({
                Action: [
                    's3:GetObject',
                    's3:PutObject'
                ],
                Effect: 'Allow',
                Resource: process.env.S3_CONTENT_ARN || '*'
            });
        } else {
            // end-user access
            policy.policyDocument.Statement.push({
                Action: 'lambda:InvokeFunction',
                Effect: 'Allow',
                Resource: process.env.LAMBDA_API_ARN || '*'
            });
            policy.policyDocument.Statement.push({
                Action: [
                    's3:GetObject'
                ],
                Effect: 'Allow',
                Resource: process.env.S3_CONTENT_ARN || '*'
            });
        }
    }
    console.log('[DYNAMIC-POLICY]', JSON.stringify((policy)));
    return policy;
}