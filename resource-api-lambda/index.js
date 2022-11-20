exports.main = async function(event, context) {
    const response = {
        message: "Success!",
        details: "The lambda function works!"
    };

    return {
        statusCode: 200,
        headers: {},
        body: JSON.stringify(response)
    };
}
