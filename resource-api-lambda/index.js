exports.main = async function(event, context) {
    const response = {
        message: "Success!",
        details: `The lambda function -- '${context.functionName}' -- works in region '${process.env.AWS_REGION}'!`
    };

    return {
        statusCode: 200,
        headers: {},
        body: JSON.stringify(response)
    };
}
