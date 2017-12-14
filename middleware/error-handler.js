module.exports = function () {
    return async (ctx, next) => {
        try {
            await next();
        } catch (err) {
            // will only respond with JSON
            if(err.response) {
                ctx.status = err.response.status;
                ctx.body = {
                    message: err.response.statusText
                };
            } else {
                ctx.status = 500;
                ctx.body = {
                    message: err.stack
                };
            }

        }
    }
};
