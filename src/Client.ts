const dynamicFetch = async () => {
    if (typeof fetch === "undefined") {
        const fetchModule = await import("node-fetch");
        return fetchModule.default;
    }
    return fetch;
};

export interface AgreementOneOffPayment {
    amount: number;
    external_id: string;
    description: string;
    expiration_timeout_minutes?: number;
}

export interface CreateAgreementParams {
    currency: string;
    links: {
        rel: string;
        href: string;
    }[];
    country_code: string;
    plan: string;
    expiration_timeout_minutes: number;
    external_id?: string;
    amount?: number;
    description?: string;
    next_payment_date?: string;
    frequency?: number;
    mobile_phone_number?: string;
    retention_period_hours?: number;
    disable_notification_management?: boolean;
    one_off_payment?: AgreementOneOffPayment;
}

export interface CreateAgreementResponse {
    id: string;
    links: [
        {
            rel: string;
            href: string;
        },
    ];
}

export interface PaymentRequestParams {
    agreement_id: string;
    amount: number;
    due_date: string;
    external_id: string;
    description: string;
    next_payment_date?: string;
    grace_period_days?: number;
}

export interface CreatePaymentRequestsResponse {
    pending_payments: {
        payment_id: string;
        external_id: string;
    }[];
    rejected_payments: {
        external_id: string;
        error_description: string;
    }[];
}

export interface OneOffPaymentParams {
    amount: number;
    external_id: string;
    description: string;
    links: [
        {
            rel: "user-redirect";
            href: string;
        },
    ];
    auto_reserve?: boolean;
    expiration_timeout_minutes?: number;
}

export interface CreateOneOffPaymentResponse {
    id: string;
    links: [
        {
            rel: "mobile-pay";
            href: string;
        },
    ];
}

export interface RefundPaymentParams {
    amount?: number;
    status_callback_url: string;
    external_id: string;
}

export interface RefundPaymentResponse {
    id: string;
    amount: number;
    status_callback_url: string;
    external_id: string;
}

export interface ClientOptions {
    discoveryEndpoint: string;
    apiEndpoint: string;
    merchant: {
        clientId: string;
        clientSecret: string;
        refreshToken: string;
        providerId: string;
    };
    application: {
        clientId: string;
        clientSecret: string;
    };
}

export enum ErrorMessage {
    NotInitialized = "MobilePay should be initialized before use",
    FailedToRenewAccessToken = "Failed to renew access token",
}

export interface Client {
    initialized(): boolean;
    initialize(): Promise<void>;
    createAgreement(params: CreateAgreementParams): Promise<CreateAgreementResponse>;
    createPaymentRequests(params: PaymentRequestParams[]): Promise<CreatePaymentRequestsResponse>;
    createOneOffPayment(agreementId: string, params: OneOffPaymentParams): Promise<CreateOneOffPaymentResponse>;
    captureOneOffPayment(agreementId: string, paymentId: string): Promise<boolean>;
    refundPayment(agreementId: string, paymentId: string, params: RefundPaymentParams): Promise<RefundPaymentResponse>;
}

export const Client = (options: ClientOptions): Client => {
    const client: Partial<Client> = {};
    let discovery: OIDCDiscovery;
    let token: OIDCTokenSet;
    let initialized = false;
    let fetch: (input: RequestInfo, init?: RequestInit) => Promise<Response>;

    client.initialized = () => {
        return initialized;
    };

    client.initialize = async () => {
        fetch = (await dynamicFetch()) as (input: RequestInfo, init?: RequestInit) => Promise<Response>;
        const response = await fetch(options.discoveryEndpoint);
        const responseBody = await response.json();
        discovery = responseBody;
        await renewAccessToken();
        initialized = true;
    };

    client.createAgreement = async (params: CreateAgreementParams): Promise<CreateAgreementResponse> => {
        await guard();
        const requestInit = createRequestInit("POST", JSON.stringify(params));
        const fetchResponse = await fetch(
            `${options.apiEndpoint}/subscriptions/api/providers/${options.merchant.providerId}/agreements`,
            requestInit,
        );
        const fetchResponseBody = await fetchResponse.json();
        return fetchResponseBody;
    };

    client.createPaymentRequests = async (params: PaymentRequestParams[]): Promise<CreatePaymentRequestsResponse> => {
        await guard();
        const requestInit = createRequestInit("POST", JSON.stringify(params));
        const fetchResponse = await fetch(
            `${options.apiEndpoint}/subscriptions/api/providers/${options.merchant.providerId}/paymentrequests`,
            requestInit,
        );
        const fetchResponseBody = await fetchResponse.json();
        return fetchResponseBody;
    };

    client.createOneOffPayment = async (
        agreementId: string,
        params: OneOffPaymentParams,
    ): Promise<CreateOneOffPaymentResponse> => {
        await guard();
        const requestInit = createRequestInit("POST", JSON.stringify(params));
        const fetchResponse = await fetch(
            `${options.apiEndpoint}/subscriptions/api/providers/${options.merchant.providerId}/agreements/${agreementId}/oneoffpayments`,
            requestInit,
        );
        const fetchResponseBody = await fetchResponse.json();
        return fetchResponseBody;
    };

    client.captureOneOffPayment = async (agreementId: string, paymentId: string): Promise<boolean> => {
        await guard();
        const requestInit = createRequestInit("POST");
        const fetchResponse = await fetch(
            `${options.apiEndpoint}/subscriptions/api/providers/${options.merchant.providerId}/agreements/${agreementId}/oneoffpayments/${paymentId}/capture`,
            requestInit,
        );
        const result = fetchResponse.status === 204;
        return result;
    };

    client.refundPayment = async (
        agreementId: string,
        paymentId: string,
        params: RefundPaymentParams,
    ): Promise<RefundPaymentResponse> => {
        await guard();
        const requestInit = createRequestInit("POST", JSON.stringify(params));
        const fetchResponse = await fetch(
            `${options.apiEndpoint}/subscriptions/api/providers/${options.merchant.providerId}/agreements/${agreementId}/payments/${paymentId}/refunds`,
            requestInit,
        );
        const fetchResponseBody = await fetchResponse.json();
        return fetchResponseBody;
    };

    const createRequestInit = (method: string, body?: string): RequestInit => {
        const requestInit: RequestInit = {
            headers: {
                "Content-Type": "application/json",
                "x-ibm-client-id": options.application.clientId,
                "x-ibm-client-secret": options.application.clientSecret,
                Authorization: `Bearer ${token.accessToken}`,
            },
            method,
            body,
        };
        return requestInit;
    };

    const guard = async () => {
        if (!initialized) {
            throw new Error(ErrorMessage.NotInitialized);
        }
        if (token.expiryDate < new Date()) {
            await renewAccessToken();
        }
    };

    const renewAccessToken = async () => {
        try {
            const formData = new URLSearchParams();
            formData.append("grant_type", "refresh_token");
            formData.append("client_id", options.merchant.clientId);
            formData.append("client_secret", options.merchant.clientSecret);
            formData.append("refresh_token", options.merchant.refreshToken);
            const requestInit: RequestInit = {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: formData as BodyInit,
            };
            const response = await fetch(discovery.token_endpoint, requestInit);
            const responseBody: OIDCTokenResponse = await response.json();
            const expiryDate = new Date();
            expiryDate.setSeconds(expiryDate.getSeconds() + responseBody.expires_in / 2);
            token = {
                response: responseBody,
                accessToken: responseBody.access_token,
                expiryDate,
            };
        } catch (error) {
            const throwError = new Error(ErrorMessage.FailedToRenewAccessToken);
            throwError.stack = error;
            throw throwError;
        }
    };

    return client as Client;
};

interface OIDCDiscovery {
    token_endpoint: string;
}

interface OIDCTokenResponse {
    id_token: string;
    access_token: string;
    expires_in: number;
    token_type: string;
    refresh_token: string;
    scope: string;
}

interface OIDCTokenSet {
    response: OIDCTokenResponse;
    accessToken: string;
    expiryDate: Date;
}
